import { createRouter, createWebHistory } from 'vue-router'
import RichTextEditor from '@/components/RichTextEditor.vue'
import AdminPortalView from '@/components/AdminPortalView.vue'

const routes = [
  {
    path: '/',
    name: 'editor',
    component: RichTextEditor,
  },
  {
    path: '/admin',
    name: 'admin',
    component: AdminPortalView,
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
