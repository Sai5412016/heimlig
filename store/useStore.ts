// store/useStore.ts
import { create } from 'zustand';
import { supabase, Household, Member, ShoppingList, ShoppingItem, Task, Transaction, Recipe, RecipeIngredient, MealType } from '../lib/supabase';
import { format, startOfWeek } from 'date-fns';

export interface SaveRecipeOpts { sourceUrl?: string; date?: string; mealType?: MealType; addToCart: boolean }
export interface PlanRecipeOpts { date: string; mealType: MealType; addToCart: boolean }

const HOUSEHOLD_CATEGORIES = ['Haushalt', 'Einkauf', 'Wartung', 'Garten'];

interface AppState {
  userId: string | null;
  setUserId: (id: string | null) => void;

  household: Household | null;
  currentMember: Member | null;
  members: Member[];
  setHousehold: (h: Household | null) => void;
  setCurrentMember: (m: Member | null) => void;
  setMembers: (m: Member[]) => void;

  shoppingLists: ShoppingList[];
  activeListId: string | null;
  items: ShoppingItem[];
  setShoppingLists: (lists: ShoppingList[]) => void;
  setActiveListId: (id: string | null) => void;
  setItems: (items: ShoppingItem[]) => void;
  toggleItem: (itemId: string) => Promise<void>;
  addItem: (listId: string, name: string, quantity?: string, category?: string, mealPlanId?: string) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;

  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  completeTask: (taskId: string) => Promise<{ points: number; isHousehold: boolean }>;

  // ✅ Scores
  weekScores: Record<string, number>; // memberId → points this week
  setWeekScores: (scores: Record<string, number>) => void;
  loadWeekScores: () => Promise<void>;

  transactions: Transaction[];
  setTransactions: (tx: Transaction[]) => void;

  // 🍳 Recipes
  recipes: Recipe[];
  setRecipes: (r: Recipe[]) => void;
  loadRecipes: () => Promise<void>;
  toggleRecipeFavorite: (id: string) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  saveRecipe: (ingredients: RecipeIngredient[], name: string, opts: SaveRecipeOpts) => Promise<{ added: number; planned: boolean }>;
  planRecipe: (recipe: Recipe, opts: PlanRecipeOpts) => Promise<{ added: number }>;

  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  userId: null,
  setUserId: (id) => set({ userId: id }),

  household: null,
  currentMember: null,
  members: [],
  setHousehold: (h) => set({ household: h }),
  setCurrentMember: (m) => set({ currentMember: m }),
  setMembers: (m) => set({ members: m }),

  shoppingLists: [],
  activeListId: null,
  items: [],
  setShoppingLists: (lists) => set({ shoppingLists: lists }),
  setActiveListId: (id) => set({ activeListId: id }),
  setItems: (items) => set({ items }),

  toggleItem: async (itemId) => {
    const item = get().items.find(i => i.id === itemId);
    if (!item) return;
    const checked = !item.checked;
    set(s => ({ items: s.items.map(i => i.id === itemId ? { ...i, checked } : i) }));
    await supabase
      .from('shopping_items')
      .update({ checked, checked_at: checked ? new Date().toISOString() : null })
      .eq('id', itemId);
  },

  addItem: async (listId, name, quantity, category = 'Sonstiges', mealPlanId) => {
    const { currentMember } = get();
    const { data } = await supabase
      .from('shopping_items')
      .insert({ list_id: listId, name, quantity, category, added_by: currentMember?.id, meal_plan_id: mealPlanId })
      .select().single();
    if (data) set(s => ({ items: [...s.items, data] }));
  },

  deleteItem: async (itemId) => {
    set(s => ({ items: s.items.filter(i => i.id !== itemId) }));
    await supabase.from('shopping_items').delete().eq('id', itemId);
  },

  tasks: [],
  setTasks: (tasks) => set({ tasks }),

  completeTask: async (taskId) => {
    const { currentMember, household, tasks, weekScores } = get();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return { points: 0, isHousehold: false };

    const now = new Date().toISOString();
    const isAlreadyCompleted = !!task.completed_at;

    // Toggle: uncomplete if already done
    set(s => ({
      tasks: s.tasks.map(t => t.id === taskId
        ? { ...t, completed_at: isAlreadyCompleted ? null : now, completed_by: isAlreadyCompleted ? null : currentMember?.id }
        : t
      )
    }));

    await supabase
      .from('tasks')
      .update({
        completed_at: isAlreadyCompleted ? null : now,
        completed_by: isAlreadyCompleted ? null : currentMember?.id
      })
      .eq('id', taskId);

    // ✅ Award points for household categories
    const isHousehold = HOUSEHOLD_CATEGORIES.includes(task.category);
    const points = task.points || (task.priority === 'high' ? 20 : task.priority === 'low' ? 5 : 10);

    if (isHousehold && currentMember && household && !isAlreadyCompleted) {
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

      // Update member_scores
      const { data: existing } = await supabase
        .from('member_scores')
        .select('*')
        .eq('member_id', currentMember.id)
        .eq('week_start', weekStart)
        .single();

      if (existing) {
        await supabase
          .from('member_scores')
          .update({
            points: existing.points + points,
            tasks_done: existing.tasks_done + 1
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('member_scores')
          .insert({
            member_id: currentMember.id,
            household_id: household.id,
            week_start: weekStart,
            points,
            tasks_done: 1,
          });
      }

      // Update local score
      set(s => ({
        weekScores: {
          ...s.weekScores,
          [currentMember.id]: (s.weekScores[currentMember.id] || 0) + points
        }
      }));

      return { points, isHousehold: true };
    }

    return { points: 0, isHousehold: false };
  },

  // ✅ Week scores
  weekScores: {},
  setWeekScores: (scores) => set({ weekScores: scores }),

  loadWeekScores: async () => {
    const { household, members } = get();
    if (!household) return;

    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('member_scores')
      .select('*')
      .eq('household_id', household.id)
      .eq('week_start', weekStart);

    if (data) {
      const scores: Record<string, number> = {};
      data.forEach(row => { scores[row.member_id] = row.points; });
      set({ weekScores: scores });
    }
  },

  transactions: [],
  setTransactions: (tx) => set({ transactions: tx }),

  // 🍳 Recipes
  recipes: [],
  setRecipes: (r) => set({ recipes: r }),

  loadRecipes: async () => {
    const { household } = get();
    if (!household) return;
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('household_id', household.id)
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false });
    if (data) set({ recipes: data });
  },

  toggleRecipeFavorite: async (id) => {
    const recipe = get().recipes.find(r => r.id === id);
    if (!recipe) return;
    const is_favorite = !recipe.is_favorite;
    set(s => ({ recipes: s.recipes.map(r => r.id === id ? { ...r, is_favorite } : r) }));
    await supabase.from('recipes').update({ is_favorite }).eq('id', id);
  },

  deleteRecipe: async (id) => {
    set(s => ({ recipes: s.recipes.filter(r => r.id !== id) }));
    await supabase.from('recipes').delete().eq('id', id);
  },

  // Create a brand-new recipe (from import) + optional meal plan + optional cart items
  saveRecipe: async (ingredients, name, opts) => {
    const { household, currentMember, activeListId, addItem } = get();
    if (!household || !currentMember) return { added: 0, planned: false };
    const { sourceUrl, date, mealType, addToCart } = opts;
    const toAdd = ingredients.filter(i => i.include);

    const { data: recipe } = await supabase.from('recipes').insert({
      household_id: household.id,
      name,
      source_url: sourceUrl,
      ingredients,
      created_by: currentMember.id,
    }).select().single();
    if (recipe) set(s => ({ recipes: [recipe, ...s.recipes] }));

    let mealPlanId: string | undefined;
    if (date && mealType && recipe) {
      const { data: mealPlan } = await supabase.from('meal_plans').insert({
        household_id: household.id,
        recipe_id: recipe.id,
        recipe_name: name,
        planned_date: date,
        meal_type: mealType,
        created_by: currentMember.id,
      }).select().single();
      mealPlanId = mealPlan?.id;
    }

    if (addToCart && activeListId) {
      for (const ing of toAdd) await addItem(activeListId, ing.name, ing.quantity, ing.category, mealPlanId);
    }
    return { added: addToCart ? toAdd.length : 0, planned: !!(date && mealType) };
  },

  // Plan an EXISTING recipe into the calendar + optionally add its ingredients to the cart
  planRecipe: async (recipe, opts) => {
    const { household, currentMember, activeListId, addItem } = get();
    if (!household || !currentMember) return { added: 0 };
    const { date, mealType, addToCart } = opts;

    const { data: mealPlan } = await supabase.from('meal_plans').insert({
      household_id: household.id,
      recipe_id: recipe.id,
      recipe_name: recipe.name,
      planned_date: date,
      meal_type: mealType,
      created_by: currentMember.id,
    }).select().single();

    const toAdd = (recipe.ingredients || []).filter(i => i.include);
    if (addToCart && activeListId) {
      for (const ing of toAdd) await addItem(activeListId, ing.name, ing.quantity, ing.category, mealPlan?.id);
    }
    return { added: addToCart ? toAdd.length : 0 };
  },

  isLoading: false,
  setIsLoading: (v) => set({ isLoading: v }),
}));
