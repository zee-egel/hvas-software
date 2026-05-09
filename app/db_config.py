import pandas as pd
from sqlalchemy import create_engine, Table, MetaData, Column, Integer, String, ForeignKey, Float, inspect, text, insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy_utils import database_exists, create_database
import random
import numpy as np
from settings import *


class PRIMSDatabase:
    def __init__(self, db_url, csv_dir):
        # Initialize database connection and metadata
        self.engine = create_engine(db_url)
        if not database_exists(self.engine.url):
            create_database(self.engine.url)
        self.metadata = MetaData()
        self.csv_dir = csv_dir
        # Define tables and load data into them
        self.create_tables()
        self.load_all_data()
        # Restore simulation state from DB (survives restarts)
        self._restore_state()
        # Per-tick transient state
        self.restocked_ingredients = dict()

    def _restore_state(self):
        """Load current_week and start_date from simulation_state table, or initialise."""
        row = pd.read_sql(text("SELECT current_week, start_date FROM simulation_state LIMIT 1"), con=self.engine)
        if row.empty:
            self.current_week = 0
            self.start_date = pd.to_datetime(START_DATE)
            with self.engine.begin() as conn:
                conn.execute(text(
                    "INSERT INTO simulation_state (id, current_week, start_date) VALUES (1, :week, :sd)"
                ), {"week": self.current_week, "sd": str(self.start_date.date())})
        else:
            self.current_week = int(row['current_week'].iloc[0])
            self.start_date = pd.to_datetime(row['start_date'].iloc[0])

    def save_state(self):
        """Persist current_week and start_date to DB."""
        with self.engine.begin() as conn:
            conn.execute(text(
                "UPDATE simulation_state SET current_week = :week, start_date = :sd WHERE id = 1"
            ), {"week": self.current_week, "sd": str(self.start_date.date())})

    def create_tables(self):
        # Inventory table
        self.inventory = Table('inventory', self.metadata,
                               Column('ingredient_id', Integer, primary_key=True),
                               Column('quantity', Float)
                               )

        # Ingredient table
        self.ingredient = Table('ingredient', self.metadata,
                                Column('ingredient_id', Integer, primary_key=True),
                                Column('ingredient_name', String(255))
                                )

        # Recipes table (one row per recipe)
        self.recipes = Table('recipes', self.metadata,
                             Column('recipe_id', Integer, primary_key=True),
                             Column('recipe_name', String(255))
                             )

        # Recipe ingredients table (recipe-ingredient mapping)
        self.recipe_ingredients = Table('recipe_ingredients', self.metadata,
                                        Column('recipe_id', Integer, ForeignKey('recipes.recipe_id'), primary_key=True),
                                        Column('ingredient_id', Integer, ForeignKey('ingredient.ingredient_id'), primary_key=True),
                                        Column('quantity', Float)
                                        )

        # Orders table
        self.orders = Table('orders', self.metadata,
                            Column('week', Integer, primary_key=True),
                            Column('recipe_id', Integer, ForeignKey('recipes.recipe_id'), primary_key=True),
                            Column('num_orders', Integer)
                            )

        # Performance Parameters table
        self.performance_parameters = Table('performance_parameters', self.metadata,
                                            Column('parameter_id', Integer, primary_key=True),
                                            Column('parameter_name', String(255))
                                            )

        # Performance Matrix table
        self.performance_matrix = Table('performance_matrix', self.metadata,
                                        Column('week', Integer, primary_key=True),
                                        Column('parameter_id', Integer,
                                               ForeignKey('performance_parameters.parameter_id'), primary_key=True),
                                        Column('value', Float)
                                        )

        # Predicted Orders table
        self.predicted_orders = Table('predicted_orders', self.metadata,
                                      Column('week', Integer, primary_key=True),
                                      Column('recipe_id', Integer, ForeignKey('recipes.recipe_id'), primary_key=True),
                                      Column('num_orders', Integer)
                                      )

        # Simulation state table (persists week counter and start_date across restarts)
        self.simulation_state = Table('simulation_state', self.metadata,
                                      Column('id', Integer, primary_key=True),
                                      Column('current_week', Integer),
                                      Column('start_date', String(20))
                                      )

        # Create all tables in the database
        self.metadata.create_all(self.engine)

    def load_all_data(self):
        self.load_and_insert_data("ingredients.csv", "ingredient", ["ingredient_id"])
        self.load_and_insert_data("recipes.csv", "recipes", ["recipe_id"], columns=["recipe_id", "recipe_name"], deduplicate_on="recipe_id")
        self.load_and_insert_data("recipes.csv", "recipe_ingredients", ["recipe_id", "ingredient_id"], columns=["recipe_id", "ingredient_id", "quantity"])
        self.load_and_insert_data("orders.csv", "orders", ["week", "recipe_id"])
        self.load_and_insert_data("inventory.csv", "inventory", ["ingredient_id"])
        self.load_and_insert_data("predicted_orders.csv", "predicted_orders", ["week", "recipe_id"])
        self.load_and_insert_data("performance_parameters.csv", "performance_parameters", ["parameter_id"])
        self.load_and_insert_data("performance_matrix.csv", "performance_matrix", ["week", "parameter_id"])

    def load_and_insert_data(self, file_name, table_name, unique_id_columns, columns=None, deduplicate_on=None):
        # Load CSV into a DataFrame
        file_path = f"{self.csv_dir}/{file_name}"
        df = pd.read_csv(file_path, sep=',', quotechar='\'', encoding='utf8')
        if columns:
            df = df[columns]
        if deduplicate_on:
            df = df.drop_duplicates(subset=deduplicate_on)
        df_filtered = df

        # Check if the table exists, then filter for new records
        if table_name in inspect(self.engine).get_table_names():
            existing_ids_query = f"SELECT {', '.join(unique_id_columns)} FROM {table_name}"
            existing_ids = pd.read_sql(existing_ids_query, con=self.engine)
            existing_ids_set = set(tuple(x) for x in existing_ids[unique_id_columns].values)
            df_filtered = df[~df[unique_id_columns].apply(tuple, axis=1).isin(existing_ids_set)]

        # Insert new records into the table
        try:
            df_filtered.to_sql(table_name, con=self.engine, index=False, if_exists='append')
            print(f"Data inserted into '{table_name}' successfully.")
        except IntegrityError as e:
            print(f"Error inserting data into '{table_name}': {e}")

    def get_inventory(self):
        inventory = pd.read_sql(
            '''SELECT b.ingredient_name, a.quantity FROM inventory a INNER JOIN ingredient b ON a.ingredient_id = b.ingredient_id ORDER BY b.ingredient_name''',
            con=self.engine
        )
        return inventory

    def get_inventory_json(self):
        inventory_df = self.get_inventory()
        inventory_dict = dict()
        for index, row in inventory_df.iterrows():
            inventory_dict[inventory_df.loc[index, 'ingredient_name']] = int(inventory_df.loc[index, 'quantity'])
        return inventory_dict

    def update_inventory_from_orders(self, week, restock_threshold=1275, restock_amount=1700):
        """Consume inventory based on actual simulated orders and restock if below threshold."""
        print(f"\n{'='*60}")
        print(f"[INVENTORY] Week {week} — threshold={restock_threshold}, restock_amount={restock_amount}")

        query = text(
            "SELECT o.num_orders, ri.ingredient_id, ri.quantity AS ingredient_qty, "
            "i.ingredient_name, inv.quantity AS inventory_qty "
            "FROM orders o "
            "INNER JOIN recipe_ingredients ri ON o.recipe_id = ri.recipe_id "
            "INNER JOIN ingredient i ON ri.ingredient_id = i.ingredient_id "
            "INNER JOIN inventory inv ON ri.ingredient_id = inv.ingredient_id "
            "WHERE o.week = :week"
        )
        order_ingredients = pd.read_sql(query, con=self.engine, params={"week": week})

        if order_ingredients.empty:
            print(f"[INVENTORY] No order ingredients found for week {week} — skipping")
            return

        print(f"[INVENTORY] Found {len(order_ingredients)} order-ingredient rows")

        consumption = {}
        for _, row in order_ingredients.iterrows():
            ing_id = int(row['ingredient_id'])
            used = row['num_orders'] * row['ingredient_qty']
            consumption[ing_id] = consumption.get(ing_id, 0) + used

        for ing_id, amount_used in consumption.items():
            print(f"[INVENTORY] Ingredient {ing_id}: will consume {amount_used}")

        with self.engine.begin() as conn:
            for ing_id, amount_used in consumption.items():
                conn.execute(text(
                    "UPDATE inventory SET quantity = quantity - :used WHERE ingredient_id = :iid"
                ), {"used": amount_used, "iid": ing_id})

            result = conn.execute(text(
                "SELECT i.ingredient_id, i.ingredient_name, inv.quantity "
                "FROM inventory inv INNER JOIN ingredient i ON inv.ingredient_id = i.ingredient_id"
            ))
            rows = result.fetchall()
            columns = result.keys()

            for row in rows:
                row_dict = dict(zip(columns, row))
                ing_id = int(row_dict['ingredient_id'])
                qty = row_dict['quantity']
                name = row_dict['ingredient_name']
                print(f"[INVENTORY] Post-decrement: {name} = {qty} (threshold={restock_threshold})")
                if qty < restock_threshold:
                    conn.execute(text(
                        "UPDATE inventory SET quantity = quantity + :amt WHERE ingredient_id = :iid"
                    ), {"amt": restock_amount, "iid": ing_id})
                    self.restocked_ingredients[name] = restock_amount
                    print(f"[RESTOCK] ✓ {name}: {qty} → {qty + restock_amount}")

        print(f"[INVENTORY] Restocked ingredients: {self.restocked_ingredients}")
        print(f"{'='*60}\n")

    def get_performance_parameter(self, week, parameter_name):
        param_id_df = pd.read_sql(
            text("SELECT parameter_id FROM performance_parameters WHERE parameter_name = :pname"),
            con=self.engine, params={"pname": parameter_name}
        )
        if param_id_df.empty:
            return None
        param_id = int(param_id_df['parameter_id'].iloc[0])

        result = pd.read_sql(
            text("SELECT value FROM performance_matrix WHERE parameter_id = :pid AND week = :week"),
            con=self.engine, params={"pid": param_id, "week": week}
        )
        if not result.empty:
            return result['value'].iloc[0]
        return None

    def update_performance_parameter(self, week, parameter_name, value):
        param_id_df = pd.read_sql(
            text("SELECT parameter_id FROM performance_parameters WHERE parameter_name = :pname"),
            con=self.engine, params={"pname": parameter_name}
        )
        if param_id_df.empty:
            return
        param_id = int(param_id_df['parameter_id'].iloc[0])

        with self.engine.begin() as conn:
            if self.get_performance_parameter(week, parameter_name) is None:
                conn.execute(text(
                    "INSERT INTO performance_matrix (week, parameter_id, value) VALUES (:week, :pid, :val)"
                ), {"week": week, "pid": param_id, "val": round(value, 2)})
            else:
                conn.execute(text(
                    "UPDATE performance_matrix SET value = :val WHERE week = :week AND parameter_id = :pid"
                ), {"val": round(value, 2), "week": week, "pid": param_id})

    def get_accuracy_history(self):
        """Read all model accuracy values from performance_matrix, ordered by week."""
        param_id_df = pd.read_sql(
            text("SELECT parameter_id FROM performance_parameters WHERE parameter_name = :pname"),
            con=self.engine, params={"pname": "model_accuracy"}
        )
        if param_id_df.empty:
            return []
        param_id = int(param_id_df['parameter_id'].iloc[0])
        rows = pd.read_sql(
            text("SELECT value FROM performance_matrix WHERE parameter_id = :pid ORDER BY week"),
            con=self.engine, params={"pid": param_id}
        )
        return [float(v) for v in rows['value']]

    def get_orders(self, week):
        orders = pd.read_sql(
            text("SELECT a.week, b.recipe_name, a.num_orders FROM orders a INNER JOIN recipes b ON a.recipe_id = b.recipe_id WHERE a.week = :week"),
            con=self.engine, params={"week": week}
        )
        if not orders.empty:
            return orders
        return None

    def update_orders(self, df):
        orders = df[['week', 'recipe_id', 'num_orders']]
        with self.engine.begin() as conn:
            for _, row in orders.iterrows():
                existing = pd.read_sql(
                    text("SELECT 1 FROM orders WHERE week = :week AND recipe_id = :rid"),
                    con=self.engine, params={"week": int(row.week), "rid": int(row.recipe_id)}
                )
                if existing.empty:
                    conn.execute(text(
                        "INSERT INTO orders (week, recipe_id, num_orders) VALUES (:week, :rid, :norders)"
                    ), {"week": int(row.week), "rid": int(row.recipe_id), "norders": int(row.num_orders)})
                else:
                    conn.execute(text(
                        "UPDATE orders SET num_orders = :norders WHERE week = :week AND recipe_id = :rid"
                    ), {"norders": int(row.num_orders), "week": int(row.week), "rid": int(row.recipe_id)})

    def get_predicted_orders(self, week):
        predicted_orders = pd.read_sql(
            text("SELECT a.week, b.recipe_name, a.num_orders FROM predicted_orders a INNER JOIN recipes b ON a.recipe_id = b.recipe_id WHERE a.week = :week"),
            con=self.engine, params={"week": week}
        )
        if not predicted_orders.empty:
            return predicted_orders
        return None

    def get_predicted_orders_json(self, week):
        predicted_orders_df = self.get_predicted_orders(week)
        if predicted_orders_df is None:
            return {}
        predicted_orders_dict = dict()
        for index, row in predicted_orders_df.iterrows():
            predicted_orders_dict[predicted_orders_df.loc[index, 'recipe_name']] = int(
                predicted_orders_df.loc[index, 'num_orders'])
        return predicted_orders_dict

    def update_predicted_orders(self, df):
        predicted_orders = df[['week', 'recipe_id', 'num_orders']]
        with self.engine.begin() as conn:
            for _, row in predicted_orders.iterrows():
                existing = pd.read_sql(
                    text("SELECT 1 FROM predicted_orders WHERE week = :week AND recipe_id = :rid"),
                    con=self.engine, params={"week": int(row.week), "rid": int(row.recipe_id)}
                )
                if existing.empty:
                    conn.execute(text(
                        "INSERT INTO predicted_orders (week, recipe_id, num_orders) VALUES (:week, :rid, :norders)"
                    ), {"week": int(row.week), "rid": int(row.recipe_id), "norders": int(row.num_orders)})
                else:
                    conn.execute(text(
                        "UPDATE predicted_orders SET num_orders = :norders WHERE week = :week AND recipe_id = :rid"
                    ), {"norders": int(row.num_orders), "week": int(row.week), "rid": int(row.recipe_id)})

    def generate_simulated_food_orders(self, week, num_orders, order_variance=30):
        recipe_ids = pd.read_sql(
            "SELECT DISTINCT b.recipe_id, b.recipe_name FROM recipes b",
            con=self.engine)

        if recipe_ids.empty:
            return None

        variance_pct = max(0, min(100, order_variance)) / 100.0
        n_recipes = len(recipe_ids)
        base_per_recipe = max(1, num_orders // n_recipes)
        simulated_rows = []
        for _, row in recipe_ids.iterrows():
            spread = int(base_per_recipe * variance_pct)
            variation = random.randint(-spread, spread) if spread > 0 else 0
            recipe_orders = max(1, base_per_recipe + variation)
            simulated_rows.append({
                'week': week,
                'num_orders': recipe_orders,
                'recipe_id': row['recipe_id'],
                'recipe_name': row['recipe_name'],
            })

        simulated_orders = pd.DataFrame(simulated_rows)
        self.update_orders(simulated_orders)
        return simulated_orders

    def generate_simulated_food_orders_json(self, week, num_orders, order_variance=30):
        simulated_orders_df = self.generate_simulated_food_orders(week, num_orders, order_variance)
        simulated_orders_dict = dict()
        if simulated_orders_df is not None:
            for index, row in simulated_orders_df.iterrows():
                simulated_orders_dict[simulated_orders_df.loc[index, 'recipe_name']] = int(
                    simulated_orders_df.loc[index, 'num_orders'])
        return simulated_orders_dict

