// store/useStore.ts
import { create } from 'zustand';
import { supabase, Household, Member, ShoppingList, ShoppingItem, Task, Transaction, Recipe, RecipeIngredient, MealType } from '../lib/supabase';
import { format, startOfWeek, parseISO, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // 🏘️ Multi-household
  myHouseholds: Household[];
  setMyHouseholds: (h: Household[]) => void;
  loadMyHouseholds: () => Promise<any[]>;
  activateHousehold: (household: Household, member: Member) => Promise<void>;
  switchHousehold: (householdId: string) => Promise<void>;
  leaveHousehold: (householdId: string) => Promise<Household[]>;

  shoppingLists: ShoppingList[];
  activeListId: string | null;
  items: ShoppingItem[];
  setShoppingLists: (lists: ShoppingList[]) => void;
  setActiveListId: (id: string | null) => void;
  setItems: (items: ShoppingItem[]) => void;
  switchList: (id: string) => Promise<void>;
  createShoppingList: (name: string, emoji: string) => Promise<void>;
  deleteShoppingList: (id: string) => Promise<void>;
  toggleItem: (itemId: string) => Promise<void>;
  addItem: (listId: string, name: string, quantity?: string, category?: string, mealPlanId?: string) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;

  // 🛒 Learned item catalog (personalized autocomplete / frequent items)
  itemCatalog: { name: string; name_key: string; category: string; count: number }[];
  loadItemCatalog: () => Promise<void>;

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

  // 🌙 Theme
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  toggleDarkMode: () => Promise<void>;
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

  // 🏘️ Multi-household
  myHouseholds: [],
  setMyHouseholds: (h) => set({ myHouseholds: h }),

  loadMyHouseholds: async () => {
    const { userId } = get();
    if (!userId) return [];
    const { data } = await supabase.from('members').select('*, households(*)').eq('user_id', userId);
    const memberships = data || [];
    set({ myHouseholds: memberships.map((m: any) => m.households).filter(Boolean) });
    return memberships;
  },

  // Load all data for a household and make it the active one
  activateHousehold: async (household, member) => {
    set({ household, currentMember: member });

    const { data: allMembers } = await supabase.from('members').select('*').eq('household_id', household.id);
    if (allMembers) set({ members: allMembers });

    let { data: lists } = await supabase.from('shopping_lists').select('*').eq('household_id', household.id);
    if (!lists || lists.length === 0) {
      const { data: newList } = await supabase
        .from('shopping_lists')
        .insert({ household_id: household.id, name: 'Einkaufsliste', emoji: '🛒', created_by: member.id })
        .select().single();
      if (newList) lists = [newList];
    }
    if (lists && lists.length > 0) {
      set({ shoppingLists: lists, activeListId: lists[0].id });
      const { data: items } = await supabase.from('shopping_items').select('*').eq('list_id', lists[0].id);
      set({ items: items || [] });
    } else {
      set({ shoppingLists: [], activeListId: null, items: [] });
    }
    // Reset per-household caches so each screen reloads fresh for the new household
    set({ tasks: [], transactions: [], recipes: [] });
  },

  switchHousehold: async (householdId) => {
    const { userId } = get();
    if (!userId) return;
    const { data: rows } = await supabase
      .from('members').select('*, households(*)')
      .eq('user_id', userId).eq('household_id', householdId).limit(1);
    const row: any = rows?.[0];
    if (!row) return;
    const household = row.households;
    const member = { ...row }; delete (member as any).households;
    await get().activateHousehold(household, member);
  },

  leaveHousehold: async (householdId) => {
    const { userId } = get();
    if (!userId) return [];
    await supabase.from('members').delete().eq('user_id', userId).eq('household_id', householdId);
    // If nobody is left in that household, remove it entirely
    const { data: remaining } = await supabase.from('members').select('id').eq('household_id', householdId);
    if (!remaining || remaining.length === 0) {
      await supabase.from('households').delete().eq('id', householdId);
    }
    const memberships = await get().loadMyHouseholds();
    return memberships.map((m: any) => m.households).filter(Boolean);
  },

  shoppingLists: [],
  activeListId: null,
  items: [],
  setShoppingLists: (lists) => set({ shoppingLists: lists }),
  setActiveListId: (id) => set({ activeListId: id }),
  setItems: (items) => set({ items }),

  switchList: async (id) => {
    if (get().activeListId === id) return;
    set({ activeListId: id, items: [] });
    const { data } = await supabase
      .from('shopping_items').select('*').eq('list_id', id)
      .order('checked', { ascending: true }).order('sort_order', { ascending: true });
    set({ items: data || [] });
  },

  createShoppingList: async (name, emoji) => {
    const { household, currentMember, shoppingLists } = get();
    if (!household || !currentMember) return;
    const { data } = await supabase
      .from('shopping_lists')
      .insert({ household_id: household.id, name, emoji, created_by: currentMember.id })
      .select().single();
    if (data) {
      set({ shoppingLists: [...shoppingLists, data], activeListId: data.id, items: [] });
    }
  },

  deleteShoppingList: async (id) => {
    const { shoppingLists, activeListId } = get();
    if (shoppingLists.length <= 1) return;
    await supabase.from('shopping_items').delete().eq('list_id', id);
    await supabase.from('shopping_lists').delete().eq('id', id);
    const newLists = shoppingLists.filter(l => l.id !== id);
    if (activeListId === id) {
      const next = newLists[0];
      set({ shoppingLists: newLists, activeListId: next.id, items: [] });
      const { data } = await supabase
        .from('shopping_items').select('*').eq('list_id', next.id)
        .order('checked', { ascending: true }).order('sort_order', { ascending: true });
      set({ items: data || [] });
    } else {
      set({ shoppingLists: newLists });
    }
  },

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
    const { currentMember, household } = get();
    const { data } = await supabase
      .from('shopping_items')
      .insert({ list_id: listId, name, quantity, category, added_by: currentMember?.id, meal_plan_id: mealPlanId })
      .select().single();
    if (data) set(s => ({ items: [...s.items, data] }));

    // Learn this item for the household (powers autocomplete & frequent suggestions)
    if (household && name.trim()) {
      supabase.rpc('bump_item_catalog', { p_household: household.id, p_name: name.trim(), p_category: category })
        .then(() => {}, () => {});
      const key = name.toLowerCase().trim();
      set(s => {
        const existing = s.itemCatalog.find(c => c.name_key === key);
        if (existing) return { itemCatalog: s.itemCatalog.map(c => c.name_key === key ? { ...c, count: c.count + 1, category } : c) };
        return { itemCatalog: [...s.itemCatalog, { name: name.trim(), name_key: key, category, count: 1 }] };
      });
    }
  },

  deleteItem: async (itemId) => {
    set(s => ({ items: s.items.filter(i => i.id !== itemId) }));
    await supabase.from('shopping_items').delete().eq('id', itemId);
  },

  itemCatalog: [],
  loadItemCatalog: async () => {
    const { household } = get();
    if (!household) return;
    const { data } = await supabase
      .from('item_catalog').select('name, name_key, category, count')
      .eq('household_id', household.id)
      .order('count', { ascending: false })
      .limit(500);
    if (data) set({ itemCatalog: data as any });
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

    // 🔄 Recurring tasks: when completing one, spawn the next occurrence
    if (!isAlreadyCompleted && task.recurrence && task.due_date) {
      const n = (task as any).recurrence_interval || 1;
      const base = parseISO(task.due_date);
      let next: Date | null = null;
      if (task.recurrence === 'daily') next = addDays(base, n);
      else if (task.recurrence === 'weekly') next = addWeeks(base, n);
      else if (task.recurrence === 'monthly') next = addMonths(base, n);
      else if (task.recurrence === 'yearly') next = addYears(base, n);
      if (next) {
        const { data: newTask } = await supabase.from('tasks').insert({
          household_id: task.household_id,
          title: task.title,
          description: task.description,
          category: task.category,
          priority: task.priority,
          points: task.points,
          assigned_to: task.assigned_to,
          due_date: format(next, 'yyyy-MM-dd'),
          due_time: (task as any).due_time || null,
          recurrence: task.recurrence,
          recurrence_interval: n,
          created_by: task.created_by,
        }).select().single();
        if (newTask) set(s => ({ tasks: [...s.tasks, newTask] }));
      }
    }

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

  // 🌙 Theme
  darkMode: false,
  setDarkMode: (v) => set({ darkMode: v }),
  toggleDarkMode: async () => {
    const next = !get().darkMode;
    set({ darkMode: next });
    await AsyncStorage.setItem('@heimlig/darkMode', next ? '1' : '0');
  },
}));
