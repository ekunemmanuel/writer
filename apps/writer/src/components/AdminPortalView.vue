<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@convex/_generated/api'
import { useQuery, useMutation, parseConvexError } from '@writer/shared'
import {
  ArrowLeft, Shield, Users, Key, Search, Check, AlertCircle, RefreshCw,
  Sparkles, CheckCircle2, Lock, SlidersHorizontal, Info, ShieldCheck
} from '@lucide/vue'
import type { Id } from '@convex/_generated/dataModel'

const router = useRouter()

// Queries & Mutations
const { data: usersList } = useQuery(api.permissions.listAllUsersWithRBAC)
const toggleRoleMutation = useMutation(api.permissions.toggleUserRole)
const toggleOverrideMutation = useMutation(api.permissions.toggleUserPermissionOverride)
const resetPasswordMutation = useMutation(api.permissions.adminResetUserPassword)

// Reactive UI state
const activeSection = ref<'users' | 'overrides' | 'rules' | 'security'>('users')
const searchQuery = ref('')
const selectedUserIdForOverride = ref<Id<'users'> | ''>('')
const updatingKey = ref<string | null>(null)
const statusNotification = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Password reset form
const resetTargetEmail = ref('')
const newPasswordInput = ref('')
const showPasswordText = ref(false)
const isSubmittingPassword = ref(false)

const availableRoles = ['admin', 'editor', 'staff', 'reader'] as const

const allActions = [
  { action: 'doc.create', label: 'Create Documents', description: 'Permission to author new documents' },
  { action: 'doc.read', label: 'Read Any Document', description: 'Global permission to view and read any staff document on the platform' },
  { action: 'doc.read.own', label: 'Read Own Document', description: 'Permission to view and read documents authored by self' },
  { action: 'doc.update', label: 'Edit Any Document', description: 'Global permission to update any user\'s document' },
  { action: 'doc.update.own', label: 'Edit Own Document', description: 'Permission to edit documents authored by self' },
  { action: 'doc.delete', label: 'Delete Any Document', description: 'Global permission to delete any user\'s document' },
  { action: 'doc.delete.own', label: 'Delete Own Document', description: 'Permission to delete documents authored by self' },
  { action: 'role.manage', label: 'Manage Roles & Permissions', description: 'Administrative access to manage user access control' },
] as const

type ActionType = (typeof allActions)[number]['action']

const isUsersLoading = computed(() => usersList.value === undefined)

// Filtered users list
const filteredUsers = computed(() => {
  if (!usersList.value) return []
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return usersList.value
  return usersList.value.filter((user) =>
    (user.name && user.name.toLowerCase().includes(query)) ||
    (user.email && user.email.toLowerCase().includes(query)) ||
    user._id.toLowerCase().includes(query)
  )
})

// Selected user object for permission overrides editor
const selectedUserForOverride = computed(() => {
  if (!usersList.value || usersList.value.length === 0) return null
  if (!selectedUserIdForOverride.value) {
    return usersList.value[0]
  }
  return usersList.value.find((u) => u._id === selectedUserIdForOverride.value) || usersList.value[0]
})

// Toggle role handler
const handleToggleRole = async (userId: Id<'users'>, role: 'admin' | 'editor' | 'staff' | 'reader') => {
  updatingKey.value = `${userId}:${role}`
  statusNotification.value = null
  try {
    const res = await toggleRoleMutation({ userId, role })
    if (res.success) {
      statusNotification.value = {
        type: 'success',
        text: `Role '${role}' updated successfully.`,
      }
    }
  } catch (err: unknown) {
    statusNotification.value = {
      type: 'error',
      text: parseConvexError(err, 'Failed to update role.'),
    }
  } finally {
    updatingKey.value = null
  }
}

// Toggle custom individual permission action override
const handleTogglePermissionOverride = async (userId: Id<'users'>, action: ActionType) => {
  updatingKey.value = `${userId}:${action}`
  statusNotification.value = null
  try {
    const res = await toggleOverrideMutation({ userId, action })
    if (res.success) {
      statusNotification.value = {
        type: 'success',
        text: `Permission action '${action}' updated for user.`,
      }
    }
  } catch (err: unknown) {
    statusNotification.value = {
      type: 'error',
      text: parseConvexError(err, 'Failed to update permission override.'),
    }
  } finally {
    updatingKey.value = null
  }
}

// Submit password reset
const handleResetPassword = async () => {
  if (!resetTargetEmail.value || !newPasswordInput.value) {
    statusNotification.value = { type: 'error', text: 'Please select a user and provide a new password.' }
    return
  }
  isSubmittingPassword.value = true
  statusNotification.value = null
  try {
    const res = await resetPasswordMutation({
      email: resetTargetEmail.value,
      newPassword: newPasswordInput.value,
    })
    if (res.success) {
      statusNotification.value = {
        type: 'success',
        text: `Password for ${resetTargetEmail.value} has been updated.`,
      }
      newPasswordInput.value = ''
    }
  } catch (err: unknown) {
    statusNotification.value = {
      type: 'error',
      text: parseConvexError(err, 'Failed to reset password.'),
    }
  } finally {
    isSubmittingPassword.value = false
  }
}

const getRoleBadgeStyle = (role: string) => {
  switch (role) {
    case 'admin':
      return 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
    case 'editor':
      return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
    case 'staff':
      return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
    default:
      return 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border-surface-300 dark:border-surface-700'
  }
}
</script>

<template>
  <div
    class="min-h-screen h-screen flex flex-col bg-surface-100 dark:bg-surface-950 text-surface-900 dark:text-surface-100 overflow-hidden font-sans">

    <!-- Top Portal Header Navbar -->
    <header
      class="h-14 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between px-6 shrink-0 shadow-sm z-30">

      <div class="flex items-center gap-4">
        <button @click="router.push('/')"
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-surface-700 dark:text-surface-200 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors border border-surface-200 dark:border-surface-700 shadow-2xs cursor-pointer">
          <ArrowLeft class="w-4 h-4" /> Back to Editor
        </button>

        <div class="h-5 w-px bg-surface-200 dark:bg-surface-800"></div>

        <div class="flex items-center gap-2.5">
          <div class="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400">
            <ShieldCheck class="w-5 h-5" />
          </div>
          <div>
            <h1 class="text-sm font-bold tracking-tight text-surface-900 dark:text-surface-50 flex items-center gap-2">
              Platform Admin Portal
              <span
                class="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800 uppercase tracking-wider">Superadmin</span>
            </h1>
          </div>
        </div>
      </div>

      <!-- Quick Platform Metrics Stats -->
      <div class="hidden md:flex items-center gap-6 text-xs text-surface-500 dark:text-surface-400">
        <div class="flex items-center gap-2">
          <Users class="w-4 h-4 text-primary-500" />
          <span>Total Users: <strong class="text-surface-900 dark:text-surface-100">{{ usersList?.length ?? 0
              }}</strong></span>
        </div>
        <div class="flex items-center gap-2">
          <Shield class="w-4 h-4 text-purple-500" />
          <span>System Roles: <strong class="text-surface-900 dark:text-surface-100">4</strong></span>
        </div>
        <div class="flex items-center gap-2">
          <Sparkles class="w-4 h-4 text-emerald-500" />
          <span>Permission Actions: <strong class="text-surface-900 dark:text-surface-100">7</strong></span>
        </div>
      </div>

    </header>

    <!-- Floating Notification Banner (Absolute positioning to prevent layout shift) -->
    <div v-if="statusNotification" :class="[
      'fixed top-16 right-6 z-50 px-4 py-3 text-xs flex items-center gap-3 rounded-xl border shadow-xl transition-all max-w-md animate-in fade-in slide-in-from-top-2 duration-200',
      statusNotification.type === 'success'
        ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
        : 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
    ]">
      <CheckCircle2 v-if="statusNotification.type === 'success'" class="w-4 h-4 text-emerald-500 shrink-0" />
      <AlertCircle v-else class="w-4 h-4 text-red-500 shrink-0" />
      <span class="flex-1 font-medium">{{ statusNotification.text }}</span>
      <button @click="statusNotification = null"
        class="text-xs font-semibold px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer">
        Dismiss
      </button>
    </div>

    <!-- Main Workspace Area (Responsive Layout) -->
    <div class="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">

      <!-- Navigation Sidebar (Responsive Tab Strip on Mobile/Tablet) -->
      <aside
        class="w-full md:w-64 bg-white dark:bg-surface-900 border-b md:border-b-0 md:border-r border-surface-200 dark:border-surface-800 p-3 sm:p-4 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto shrink-0 z-20">
        <div class="hidden md:block text-[11px] font-semibold text-surface-400 uppercase tracking-wider px-3 mb-2">
          Portal Navigation</div>

        <button @click="activeSection = 'users'"
          :class="['flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 md:w-full', activeSection === 'users' ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-900' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800']">
          <Users class="w-4 h-4" /> <span>Users & Roles</span>
        </button>

        <button @click="activeSection = 'overrides'"
          :class="['flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 md:w-full', activeSection === 'overrides' ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-900' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800']">
          <SlidersHorizontal class="w-4 h-4" /> <span>Permission Overrides</span>
        </button>

        <button @click="activeSection = 'rules'"
          :class="['flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 md:w-full', activeSection === 'rules' ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-900' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800']">
          <Shield class="w-4 h-4" /> <span>Role Rules</span>
        </button>

        <button @click="activeSection = 'security'"
          :class="['flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 md:w-full', activeSection === 'security' ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-900' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800']">
          <Key class="w-4 h-4" /> <span>Password Reset</span>
        </button>

        <div
          class="hidden md:block mt-auto p-3 rounded-lg bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-800 text-[11px] text-surface-500 dark:text-surface-400 space-y-1">
          <div class="font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-1.5">
            <Info class="w-3.5 h-3.5 text-primary-500" /> Permission Enforcement
          </div>
          <p class="text-[11px] leading-snug">Authorization evaluates individual permission actions. Overrides grant or
            revoke specific actions per user.</p>
        </div>
      </aside>

      <!-- Right Main Content Area -->
      <main class="flex-1 overflow-y-auto p-8 space-y-6">

        <!-- SECTION 1: Users & Role Roster -->
        <div v-if="activeSection === 'users'" class="space-y-6 max-w-6xl">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-bold text-surface-900 dark:text-surface-100">User Roster & Role Assignments</h2>
              <p class="text-xs text-surface-500 dark:text-surface-400">View registered users and toggle their assigned
                role templates (Admin, Editor, Staff, Reader).</p>
            </div>

            <!-- Search Bar -->
            <div class="relative w-72">
              <Search class="w-4 h-4 absolute left-3 top-2.5 text-surface-400" />
              <input v-model="searchQuery" type="text" placeholder="Filter users..."
                class="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            </div>
          </div>

          <!-- Loading state -->
          <div v-if="isUsersLoading" class="py-16 flex justify-center items-center text-surface-400 gap-2">
            <RefreshCw class="w-5 h-5 animate-spin text-primary-500" />
            <span class="text-xs font-medium">Fetching users from Convex backend...</span>
          </div>

          <!-- User Table & Mobile Roster -->
          <div v-else
            class="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl overflow-hidden shadow-xs">

            <!-- Mobile Card View (visible on small screens) -->
            <div class="block md:hidden divide-y divide-surface-100 dark:divide-surface-800/60">
              <div v-for="user in filteredUsers" :key="user._id" class="p-4 space-y-3">
                <div class="font-mono text-[10px] text-surface-400 select-all flex items-center gap-1">
                  <span class="text-surface-400 font-sans">ID:</span> {{ user._id }}
                </div>

                <div class="flex items-center gap-3">
                  <div
                    class="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 font-bold flex items-center justify-center text-sm shrink-0 shadow-2xs">
                    {{ user.email.slice(0, 1).toUpperCase() }}
                  </div>
                  <div>
                    <div class="font-bold text-surface-900 dark:text-surface-100 text-xs">{{ user.name }}</div>
                    <div class="text-surface-400 text-[11px] font-mono">{{ user.email }}</div>
                  </div>
                </div>

                <div class="pt-1">
                  <div class="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Assigned
                    Roles:</div>
                  <div class="flex flex-wrap gap-2 items-center">
                    <button v-for="role in availableRoles" :key="role" @click="handleToggleRole(user._id, role)"
                      :disabled="updatingKey === `${user._id}:${role}`" :class="[
                        'px-3 py-1 rounded-full border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs',
                        user.roles.includes(role) ? getRoleBadgeStyle(role) : 'bg-transparent border-dashed border-surface-300 dark:border-surface-700 text-surface-400 hover:border-surface-400 hover:text-surface-700 dark:hover:text-surface-200'
                      ]">
                      <RefreshCw v-if="updatingKey === `${user._id}:${role}`" class="w-3 h-3 animate-spin" />
                      <Check v-else-if="user.roles.includes(role)" class="w-3 h-3" />
                      <span class="capitalize">{{ role }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Desktop Table View (visible on medium screens and up) -->
            <table class="hidden md:table w-full text-left text-xs border-collapse">
              <thead>
                <tr
                  class="bg-surface-50 dark:bg-surface-800/80 border-b border-surface-200 dark:border-surface-800 text-surface-500 dark:text-surface-400 font-semibold uppercase tracking-wider">
                  <th class="py-3.5 px-5">User Profile</th>
                  <th class="py-3.5 px-5">Assigned Roles (Click to Toggle)</th>
                  <th class="py-3.5 px-5 text-right">User ID</th>
                </tr>
              </thead>
              <tbody
                class="divide-y divide-surface-100 dark:divide-surface-800/60 text-surface-800 dark:text-surface-200">
                <tr v-for="user in filteredUsers" :key="user._id"
                  class="hover:bg-surface-50/60 dark:hover:bg-surface-800/40 transition-colors">
                  <td class="py-4 px-5">
                    <div class="flex items-center gap-3">
                      <div
                        class="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 font-bold flex items-center justify-center text-sm shrink-0 shadow-2xs">
                        {{ user.email.slice(0, 1).toUpperCase() }}
                      </div>
                      <div>
                        <div class="text-[10px] font-mono text-surface-400 select-all mb-0.5">{{ user._id }}</div>
                        <div class="font-bold text-surface-900 dark:text-surface-100 text-xs">{{ user.name }}</div>
                        <div class="text-surface-400 text-[11px] font-mono">{{ user.email }}</div>
                      </div>
                    </div>
                  </td>

                  <td class="py-4 px-5">
                    <div class="flex flex-wrap gap-2 items-center">
                      <button v-for="role in availableRoles" :key="role" @click="handleToggleRole(user._id, role)"
                        :disabled="updatingKey === `${user._id}:${role}`" :class="[
                          'px-3 py-1 rounded-full border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs',
                          user.roles.includes(role) ? getRoleBadgeStyle(role) : 'bg-transparent border-dashed border-surface-300 dark:border-surface-700 text-surface-400 hover:border-surface-400 hover:text-surface-700 dark:hover:text-surface-200'
                        ]">
                        <RefreshCw v-if="updatingKey === `${user._id}:${role}`" class="w-3 h-3 animate-spin" />
                        <Check v-else-if="user.roles.includes(role)" class="w-3 h-3" />
                        <span class="capitalize">{{ role }}</span>
                      </button>
                    </div>
                  </td>

                  <td class="py-4 px-5 text-right font-mono text-[11px] text-surface-400 select-all">
                    {{ user._id }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- SECTION 2: Custom Permission Action Overrides Editor -->
        <div v-if="activeSection === 'overrides'" class="space-y-6 max-w-5xl">
          <div>
            <h2 class="text-lg font-bold text-surface-900 dark:text-surface-100">Per-User Permission Action Overrides
            </h2>
            <p class="text-xs text-surface-500 dark:text-surface-400">Grant or revoke individual permission actions for
              a specific user, independently of their assigned role.</p>
          </div>

          <!-- User Selector Header Card (Flex Column Layout) -->
          <div
            class="bg-white dark:bg-surface-900 p-5 rounded-xl border border-surface-200 dark:border-surface-800 shadow-xs space-y-4">
            <div class="flex flex-col gap-3">
              <div>
                <label class="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1">Select User to
                  Customize</label>
                <select v-model="selectedUserIdForOverride"
                  class="px-3.5 py-2 text-xs font-medium rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-full sm:max-w-md">
                  <option v-for="user in usersList" :key="user._id" :value="user._id">
                    {{ user.name }} ({{ user.email }})
                  </option>
                </select>
              </div>

              <div v-if="selectedUserForOverride"
                class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-50 dark:bg-surface-800/80 px-4 py-2.5 rounded-lg border border-surface-200 dark:border-surface-700">
                <div class="text-xs flex items-center gap-2">
                  <span class="text-surface-400">Selected User: </span>
                  <strong class="text-surface-900 dark:text-surface-100 font-bold">{{ selectedUserForOverride.email
                    }}</strong>
                </div>
                <div class="flex gap-1 items-center">
                  <span v-for="r in selectedUserForOverride.roles" :key="r"
                    class="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300">
                    {{ r }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Interactive Permission Actions Grid -->
          <div v-if="selectedUserForOverride" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="item in allActions" :key="item.action"
              class="bg-white dark:bg-surface-900 p-5 rounded-xl border border-surface-200 dark:border-surface-800 flex items-start justify-between gap-4 hover:border-surface-300 dark:hover:border-surface-700 transition-colors shadow-xs">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-xs text-surface-900 dark:text-surface-100">{{ item.label }}</span>
                  <span
                    class="px-2 py-0.5 rounded font-mono text-[10px] bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400">
                    {{ item.action }}
                  </span>
                </div>
                <p class="text-[11px] text-surface-500 dark:text-surface-400 leading-snug">{{ item.description }}</p>
              </div>

              <button @click="handleTogglePermissionOverride(selectedUserForOverride._id, item.action)"
                :disabled="updatingKey === `${selectedUserForOverride._id}:${item.action}`" :class="[
                  'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 disabled:opacity-50',
                  selectedUserForOverride.permissions.includes(item.action)
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                    : 'bg-surface-100 dark:bg-surface-800 text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 border border-surface-200 dark:border-surface-700'
                ]">
                <RefreshCw v-if="updatingKey === `${selectedUserForOverride._id}:${item.action}`"
                  class="w-3.5 h-3.5 animate-spin" />
                <Check v-else-if="selectedUserForOverride.permissions.includes(item.action)" class="w-3.5 h-3.5" />
                <span>{{ selectedUserForOverride.permissions.includes(item.action) ? 'Granted' : 'Grant Action'
                  }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- SECTION 3: Role Definitions & System Rules -->
        <div v-if="activeSection === 'rules'" class="space-y-6 max-w-5xl">
          <div>
            <h2 class="text-lg font-bold text-surface-900 dark:text-surface-100">System Role Definitions & Permission
              Matrix</h2>
            <p class="text-xs text-surface-500 dark:text-surface-400">System templates define default action grant
              bundles for quick role assignments.</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div
              class="bg-white dark:bg-surface-900 p-6 rounded-xl border border-surface-200 dark:border-surface-800 space-y-3 shadow-xs">
              <div class="flex items-center justify-between">
                <span
                  class="font-extrabold text-sm text-purple-700 dark:text-purple-300 uppercase tracking-wider">Admin</span>
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-100 dark:bg-purple-950 text-purple-600 border border-purple-300 dark:border-purple-800">Wildcard
                  Grant</span>
              </div>
              <p class="text-xs text-surface-500 dark:text-surface-400">Superadministrator with full access to all
                resources, document management, and role assignment.</p>
              <div class="flex flex-wrap gap-1.5 pt-2">
                <span
                  class="px-2 py-1 rounded bg-purple-50 dark:bg-purple-950/60 font-mono text-[11px] text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">*
                  (All Actions)</span>
              </div>
            </div>

            <div
              class="bg-white dark:bg-surface-900 p-6 rounded-xl border border-surface-200 dark:border-surface-800 space-y-3 shadow-xs">
              <div class="flex items-center justify-between">
                <span
                  class="font-extrabold text-sm text-blue-700 dark:text-blue-300 uppercase tracking-wider">Editor</span>
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-100 dark:bg-blue-950 text-blue-600 border border-blue-300 dark:border-blue-800">Global
                  Documents</span>
              </div>
              <p class="text-xs text-surface-500 dark:text-surface-400">Editor capable of creating, reading, editing,
                and deleting any staff document on the platform.</p>
              <div class="flex flex-wrap gap-1.5 pt-2">
                <span v-for="g in ['doc.create', 'doc.read', 'doc.update', 'doc.delete']" :key="g"
                  class="px-2 py-1 rounded bg-blue-50 dark:bg-blue-950/60 font-mono text-[11px] text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">{{
                  g }}</span>
              </div>
            </div>

            <div
              class="bg-white dark:bg-surface-900 p-6 rounded-xl border border-surface-200 dark:border-surface-800 space-y-3 shadow-xs">
              <div class="flex items-center justify-between">
                <span
                  class="font-extrabold text-sm text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Staff</span>
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-600 border border-emerald-300 dark:border-emerald-800">Own
                  Scope Only</span>
              </div>
              <p class="text-xs text-surface-500 dark:text-surface-400">Staff member who can manage their own documents
                while reading shared content.</p>
              <div class="flex flex-wrap gap-1.5 pt-2">
                <span v-for="g in ['doc.create', 'doc.read.own', 'doc.update.own', 'doc.delete.own']" :key="g"
                  class="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/60 font-mono text-[11px] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">{{
                  g }}</span>
              </div>
            </div>

            <div
              class="bg-white dark:bg-surface-900 p-6 rounded-xl border border-surface-200 dark:border-surface-800 space-y-3 shadow-xs">
              <div class="flex items-center justify-between">
                <span
                  class="font-extrabold text-sm text-surface-600 dark:text-surface-400 uppercase tracking-wider">Reader
                  / Guest</span>
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-100 dark:bg-surface-800 text-surface-500 border border-surface-300 dark:border-surface-700">Read-Only</span>
              </div>
              <p class="text-xs text-surface-500 dark:text-surface-400">Read-only default permissions for
                unauthenticated visitors and guests.</p>
              <div class="flex flex-wrap gap-1.5 pt-2">
                <span
                  class="px-2 py-1 rounded bg-surface-100 dark:bg-surface-800 font-mono text-[11px] text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-700">doc.read.own</span>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION 4: Account Password Reset -->
        <div v-if="activeSection === 'security'" class="max-w-md mx-auto py-8 space-y-6">
          <div class="text-center space-y-1">
            <div
              class="inline-flex p-3 rounded-full bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 mb-2">
              <Lock class="w-6 h-6" />
            </div>
            <h3 class="text-base font-bold text-surface-900 dark:text-surface-100">Reset User Account Password</h3>
            <p class="text-xs text-surface-500 dark:text-surface-400">Direct password modification tool for platform
              administrators.</p>
          </div>

          <div
            class="space-y-4 bg-white dark:bg-surface-900 p-6 rounded-xl border border-surface-200 dark:border-surface-800 shadow-xs">
            <div>
              <label class="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">Select Target
                Account</label>
              <select v-model="resetTargetEmail"
                class="w-full px-3.5 py-2 text-xs rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20">
                <option value="" disabled>-- Select User --</option>
                <option v-for="user in usersList" :key="user._id" :value="user.email">
                  {{ user.email }} ({{ user.name }})
                </option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">New
                Password</label>
              <div class="relative">
                <input v-model="newPasswordInput" :type="showPasswordText ? 'text' : 'password'"
                  placeholder="Enter new strong password"
                  class="w-full px-3.5 py-2 text-xs rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                <button type="button" @click="showPasswordText = !showPasswordText"
                  class="absolute right-3 top-2 text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 cursor-pointer">
                  {{ showPasswordText ? 'Hide' : 'Show' }}
                </button>
              </div>
            </div>

            <button @click="handleResetPassword"
              :disabled="isSubmittingPassword || !resetTargetEmail || !newPasswordInput"
              class="w-full py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-2xs">
              <RefreshCw v-if="isSubmittingPassword" class="w-4 h-4 animate-spin" />
              <Key v-else class="w-4 h-4" />
              <span>Reset Account Password</span>
            </button>
          </div>
        </div>

      </main>

    </div>

  </div>
</template>
