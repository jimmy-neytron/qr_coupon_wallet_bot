import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import GroupsView from '../views/GroupsView.vue';
import ProfileView from '../views/ProfileView.vue';

/** Application routes. Each route maps to one product screen. */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { label: 'Промокоды' },
    },
    {
      path: '/groups',
      name: 'groups',
      component: GroupsView,
      meta: { label: 'Категории' },
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
      meta: { label: 'Профиль' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
});
