import { useEffect, useState } from "react";
import { BookOpen, Plus, Trash, X } from "./Icons";
import {
  fetchRecipes,
  fetchIngredients,
  createRecipe,
  deleteRecipe,
  createIngredient,
  type ApiRecipe,
  type ApiIngredient,
} from "../api/client";

/* ── Local types ─────────────────────────────────────────────── */

interface RecipeIngredient {
  ingredientId: number;
  quantity: number;
}

/* ── Component ───────────────────────────────────────────────── */

type Tab = "recipes" | "ingredients";

export default function Recipes() {
  const [tab, setTab] = useState<Tab>("recipes");
  const [ingredients, setIngredients] = useState<ApiIngredient[]>([]);
  const [recipes, setRecipes] = useState<ApiRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  /* Ingredient form */
  const [newIngName, setNewIngName] = useState("");
  const [showIngForm, setShowIngForm] = useState(false);

  /* Recipe form */
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [recipeIngredients, setRecipeIngredients] = useState<
    RecipeIngredient[]
  >([]);

  /* ── Load data from backend ──────────────────────────────── */

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [r, i] = await Promise.all([fetchRecipes(), fetchIngredients()]);
      setRecipes(r);
      setIngredients(i);
    } catch (e) {
      console.error("Failed to load recipes/ingredients", e);
    } finally {
      setLoading(false);
    }
  }

  /* ── Ingredient helpers ──────────────────────────────────── */

  async function addIngredient() {
    const trimmed = newIngName.trim();
    if (!trimmed) return;
    if (ingredients.some((i) => i.name.toLowerCase() === trimmed.toLowerCase()))
      return;
    try {
      await createIngredient(trimmed);
      await loadData();
      setNewIngName("");
      setShowIngForm(false);
    } catch (e) {
      console.error("Failed to add ingredient", e);
    }
  }

  /* ── Recipe helpers ──────────────────────────────────────── */

  function addRecipeIngredientRow() {
    const unused = ingredients.filter(
      (i) => !recipeIngredients.some((ri) => ri.ingredientId === i.id),
    );
    if (unused.length === 0) return;
    setRecipeIngredients([
      ...recipeIngredients,
      { ingredientId: unused[0].id, quantity: 1 },
    ]);
  }

  function updateRecipeIngredient(
    idx: number,
    field: "ingredientId" | "quantity",
    value: number,
  ) {
    setRecipeIngredients(
      recipeIngredients.map((ri, i) =>
        i === idx ? { ...ri, [field]: value } : ri,
      ),
    );
  }

  function removeRecipeIngredientRow(idx: number) {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx));
  }

  async function saveRecipe() {
    const trimmed = recipeName.trim();
    if (!trimmed || recipeIngredients.length === 0) return;
    try {
      await createRecipe(trimmed, recipeIngredients);
      await loadData();
      resetRecipeForm();
    } catch (e) {
      console.error("Failed to save recipe", e);
    }
  }

  async function removeRecipe(id: number) {
    try {
      await deleteRecipe(id);
      await loadData();
    } catch (e) {
      console.error("Failed to delete recipe", e);
    }
  }

  function resetRecipeForm() {
    setRecipeName("");
    setRecipeIngredients([]);
    setShowRecipeForm(false);
  }

  /* ── Render ──────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <p className="text-body text-sm">Loading recipes…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-border/10">
        <div>
          <h2 className="text-2xl font-semibold text-heading tracking-tight">
            Recipes &amp; Ingredients
          </h2>
          <p className="text-sm text-body mt-0.5">
            Create and manage your recipes and ingredient catalogue
          </p>
        </div>
      </header>

      <main className="flex-1 p-8 flex flex-col gap-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-card rounded-lg border border-border/10 p-1 w-fit">
          {(["recipes", "ingredients"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? "bg-emerald/10 text-emerald-dark"
                  : "text-body hover:text-subtitle"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Recipes Tab ──────────────────────────────────── */}
        {tab === "recipes" && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-heading">
                Your Recipes
              </h3>
              <button
                onClick={() => setShowRecipeForm(true)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald to-emerald-dark text-white px-4 py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Add Recipe
              </button>
            </div>

            {/* Add-recipe modal */}
            {showRecipeForm && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div className="bg-card rounded-xl border border-border/10 p-6 w-full max-w-lg shadow-xl">
                  <div className="flex items-center justify-between mb-5">
                    <h4 className="text-lg font-semibold text-heading">
                      New Recipe
                    </h4>
                    <button
                      onClick={resetRecipeForm}
                      className="p-1 rounded-md hover:bg-bg transition-colors"
                    >
                      <X className="w-5 h-5 text-body" />
                    </button>
                  </div>

                  <label className="block text-sm font-medium text-subtitle mb-1.5">
                    Recipe Name
                  </label>
                  <input
                    type="text"
                    value={recipeName}
                    onChange={(e) => setRecipeName(e.target.value)}
                    placeholder="e.g. Margherita Pizza"
                    className="w-full bg-bg border border-border/15 rounded-md px-4 py-2.5 text-sm text-heading placeholder:text-body/50 focus:outline-none focus:ring-2 focus:ring-emerald/30 mb-5"
                  />

                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-subtitle">
                      Ingredients
                    </label>
                    <button
                      onClick={addRecipeIngredientRow}
                      disabled={recipeIngredients.length >= ingredients.length}
                      className="text-xs font-medium text-emerald-dark hover:text-emerald disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      + Add ingredient
                    </button>
                  </div>

                  {recipeIngredients.length === 0 && (
                    <p className="text-sm text-body/60 mb-4">
                      No ingredients added yet. Click &quot;+ Add
                      ingredient&quot; above.
                    </p>
                  )}

                  <div className="flex flex-col gap-2 mb-5 max-h-48 overflow-y-auto">
                    {recipeIngredients.map((ri, idx) => {
                      const usedIds = recipeIngredients
                        .filter((_, i) => i !== idx)
                        .map((r) => r.ingredientId);
                      const available = ingredients.filter(
                        (i) =>
                          i.id === ri.ingredientId || !usedIds.includes(i.id),
                      );

                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            value={ri.ingredientId}
                            onChange={(e) =>
                              updateRecipeIngredient(
                                idx,
                                "ingredientId",
                                Number(e.target.value),
                              )
                            }
                            className="flex-1 bg-bg border border-border/15 rounded-md px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-emerald/30"
                          >
                            {available.map((ing) => (
                              <option key={ing.id} value={ing.id}>
                                {ing.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            value={ri.quantity}
                            onChange={(e) =>
                              updateRecipeIngredient(
                                idx,
                                "quantity",
                                Math.max(1, Number(e.target.value)),
                              )
                            }
                            className="w-20 bg-bg border border-border/15 rounded-md px-3 py-2 text-sm text-heading text-center focus:outline-none focus:ring-2 focus:ring-emerald/30"
                          />
                          <button
                            onClick={() => removeRecipeIngredientRow(idx)}
                            className="p-2 rounded-md hover:bg-alert/10 transition-colors"
                          >
                            <Trash className="w-4 h-4 text-alert" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={resetRecipeForm}
                      className="px-4 py-2.5 rounded-md text-sm font-medium text-body hover:bg-bg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveRecipe}
                      disabled={
                        !recipeName.trim() || recipeIngredients.length === 0
                      }
                      className="px-5 py-2.5 rounded-md text-sm font-medium bg-gradient-to-r from-emerald to-emerald-dark text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      Save Recipe
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Recipe cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="bg-card rounded-xl border border-border/10 p-5 flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald/10 flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-emerald-dark" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-heading">
                          {recipe.name}
                        </h4>
                        <span className="text-xs text-body">
                          {recipe.ingredients.length} ingredient
                          {recipe.ingredients.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeRecipe(recipe.id)}
                      className="p-1.5 rounded-md hover:bg-alert/10 transition-colors"
                    >
                      <Trash className="w-4 h-4 text-body hover:text-alert" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {recipe.ingredients.map((ri) => (
                      <span
                        key={ri.ingredientId}
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-bg text-subtitle"
                      >
                        {ri.name}
                        <span className="text-body/60">×{ri.quantity}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {recipes.length === 0 && (
                <div className="col-span-full text-center py-12 text-body text-sm">
                  No recipes yet. Click &quot;Add Recipe&quot; to create one.
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Ingredients Tab ──────────────────────────────── */}
        {tab === "ingredients" && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-heading">
                Ingredient Catalogue
              </h3>
              <button
                onClick={() => setShowIngForm(true)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald to-emerald-dark text-white px-4 py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Add Ingredient
              </button>
            </div>

            {/* Inline add form */}
            {showIngForm && (
              <div className="bg-card rounded-xl border border-border/10 p-5 flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-subtitle mb-1.5">
                    Ingredient Name
                  </label>
                  <input
                    type="text"
                    value={newIngName}
                    onChange={(e) => setNewIngName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addIngredient()}
                    placeholder="e.g. Olive Oil"
                    autoFocus
                    className="w-full bg-bg border border-border/15 rounded-md px-4 py-2.5 text-sm text-heading placeholder:text-body/50 focus:outline-none focus:ring-2 focus:ring-emerald/30"
                  />
                </div>
                <button
                  onClick={addIngredient}
                  disabled={!newIngName.trim()}
                  className="px-5 py-2.5 rounded-md text-sm font-medium bg-gradient-to-r from-emerald to-emerald-dark text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowIngForm(false);
                    setNewIngName("");
                  }}
                  className="px-4 py-2.5 rounded-md text-sm font-medium text-body hover:bg-bg transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Ingredient table */}
            <div className="bg-card rounded-xl border border-border/10 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/10">
                    <th className="px-6 py-4 text-xs font-medium text-body uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-4 text-xs font-medium text-body uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-xs font-medium text-body uppercase tracking-wider">
                      Used In
                    </th>
                    <th className="px-6 py-4 text-xs font-medium text-body uppercase tracking-wider w-20" />
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ing) => {
                    const usedIn = recipes.filter((r) =>
                      r.ingredients.some((ri) => ri.ingredientId === ing.id),
                    );
                    return (
                      <tr
                        key={ing.id}
                        className="border-b border-border/10 last:border-0"
                      >
                        <td className="px-6 py-4 text-sm text-body">
                          #{ing.id}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-heading">
                          {ing.name}
                        </td>
                        <td className="px-6 py-4">
                          {usedIn.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {usedIn.map((r) => (
                                <span
                                  key={r.id}
                                  className="text-xs px-2 py-0.5 rounded-full bg-emerald-light text-badge-green"
                                >
                                  {r.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-body/50">
                              Not used
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right"></td>
                      </tr>
                    );
                  })}
                  {ingredients.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-8 text-center text-body text-sm"
                      >
                        No ingredients yet. Click &quot;Add Ingredient&quot; to
                        add one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
