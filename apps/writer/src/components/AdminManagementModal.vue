<script setup lang="ts">
import { ref, computed } from 'vue'
import { api } from '@convex/_generated/api'
import { useQuery, useMutation, parseConvexError } from '@writer/shared'
import {
  X, Shield, User, Key, Search, Check, AlertCircle, RefreshCw, Sparkles, CheckCircle2, Lock
} from '@lucide/vue'

import type { Id } from '@convex/_generated/dataModel'

const emit = defineEmits(['close'])

// Data Queries & Mutations
const { data: usersList } = useQuery(api.permissions.listAllUsersWithRBAC)
const isUsersLoading = computed(() => usersList.value === undefined)
const toggleRoleMutation = useMutation(api.permissions.toggleUserRole)
const resetPasswordMutation = useMutation(api.permissions.adminResetUserPassword)

// Local UI state
const activeTab = ref<'users' | 'permissions' | 'password'>('users')
const searchQuery = ref('')
const updatingUserId = ref<Id<'users'> | null>(null)
const statusMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Password reset form state
const selectedUserEmail = ref('')
const newPasswordInput = ref('')
const showPassword = ref(false)
const isResettingPassword = ref(false)

const availableRoles = ['admin', 'editor', 'staff', 'reader'] as const

// Filtered users list
const filteredUsers = computed(() => {
  if (!usersList.value) return []
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return usersList.value
  return usersList.value.filter((user) =>
    (user.name && user.name.toLowerCase().includes(query)) ||
    (user.email && user.email.toLowerCase().includes(query))
  )
})

// Toggle user role mutation handler
const handleToggleRole = async (userId: Id<'users'>, role: 'admin' | 'editor' | 'staff' | 'reader') => {
  updatingUserId.value = userId
  statusMessage.value = null
  try {
    const res = await toggleRoleMutation({ userId, role })
    if (res.success) {
      statusMessage.value = {
        type: 'success',
        text: `Role '${role}' updated successfully.`,
      }
    }
  } catch (err: unknown) {
    statusMessage.value = {
      type: 'error',
      text: parseConvexError(err, 'Failed to update role.'),
    }
  } finally {
    updatingUserId.value = null
  }
}

// Password reset submission handler
const handleResetPassword = async () => {
  if (!selectedUserEmail.value || !newPasswordInput.value) {
    statusMessage.value = { type: 'error', text: 'Please fill in both email and new password.' }
    return
  }
  isResettingPassword.value = true
  statusMessage.value = null
  try {
    const res = await resetPasswordMutation({
      email: selectedUserEmail.value,
      newPassword: newPasswordInput.value,
    })
    if (res.success) {
      statusMessage.value = {
        type: 'success',
        text: `Password for ${selectedUserEmail.value} has been updated.`,
      }
      newPasswordInput.value = ''
    }
  } catch (err: unknown) {
    statusMessage.value = {
      type: 'error',
      text: parseConvexError(err, 'Failed to reset password.'),
    }
  } finally {
    isResettingPassword.value = false
  }
}

const getRoleBadgeStyle = (role: string) => {
  switch (role) {
    case 'admin':
      return 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
    case 'editor':
      return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
    case 'staff':
      return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
    default:
      return 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border-surface-300 dark:border-surface-700'
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
    <div class="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between bg-surface-50/50 dark:bg-surface-900/50">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400">
            <Shield class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-100">Admin Management Panel</h2>
            <p class="text-xs text-surface-500 dark:text-surface-400">Manage user roles, permissions, and accounts in real-time</p>
          </div>
        </div>
        <button @click="emit('close')" class="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div class="px-6 border-b border-surface-200 dark:border-surface-800 flex gap-6 text-sm font-medium">
        <button
          @click="activeTab = 'users'"
          :class="['py-3 border-b-2 transition-colors flex items-center gap-2', activeTab === 'users' ? 'border-primary-600 text-primary-600 dark:text-primary-400 font-semibold' : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300']"
        >
          <User class="w-4 h-4" /> User Roles Roster
        </button>
        <button
          @click="activeTab = 'permissions'"
          :class="['py-3 border-b-2 transition-colors flex items-center gap-2', activeTab === 'permissions' ? 'border-primary-600 text-primary-600 dark:text-primary-400 font-semibold' : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300']"
        >
          <Sparkles class="w-4 h-4" /> Effective Permissions
        </button>
        <button
          @click="activeTab = 'password'"
          :class="['py-3 border-b-2 transition-colors flex items-center gap-2', activeTab === 'password' ? 'border-primary-600 text-primary-600 dark:text-primary-400 font-semibold' : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300']"
        >
          <Key class="w-4 h-4" /> Password Reset
        </button>
      </div>

      <!-- Status Notification Banner -->
      <div v-if="statusMessage" :class="['px-6 py-2.5 text-xs flex items-center justify-between border-b', statusMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900']">
        <div class="flex items-center gap-2">
          <CheckCircle2 v-if="statusMessage.type === 'success'" class="w-4 h-4 text-emerald-500" />
          <AlertCircle v-else class="w-4 h-4 text-red-500" />
          <span>{{ statusMessage.text }}</span>
        </div>
        <button @click="statusMessage = null" class="text-xs underline opacity-80 hover:opacity-100">Dismiss</button>
      </div>

      <!-- Modal Body -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">

        <!-- TAB 1: User Roles Roster -->
        <div v-if="activeTab === 'users'" class="space-y-4">
          <!-- Search Bar -->
          <div class="relative">
            <Search class="w-4 h-4 absolute left-3.5 top-3 text-surface-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search users by name or email..."
              class="w-full pl-10 pr-4 py-2 text-sm rounded-lg bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>

          <!-- Users Table -->
          <div v-if="isUsersLoading" class="py-12 flex justify-center items-center text-surface-400 gap-2">
            <RefreshCw class="w-5 h-5 animate-spin" />
            <span class="text-sm">Loading users roster...</span>
          </div>

          <div v-else-if="filteredUsers.length === 0" class="py-12 text-center text-surface-400 text-sm">
            No users found matching your query.
          </div>

          <div v-else class="border border-surface-200 dark:border-surface-800 rounded-lg overflow-hidden">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-surface-100/70 dark:bg-surface-800/70 border-b border-surface-200 dark:border-surface-800 text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                  <th class="py-3 px-4">User</th>
                  <th class="py-3 px-4">Assigned Roles (Click to Toggle)</th>
                  <th class="py-3 px-4 text-right">User ID</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-surface-100 dark:divide-surface-800/60 text-surface-800 dark:text-surface-200">
                <tr v-for="user in filteredUsers" :key="user._id" class="hover:bg-surface-50/60 dark:hover:bg-surface-800/40 transition-colors">
                  <td class="py-3.5 px-4 font-medium">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 font-bold flex items-center justify-center text-sm shrink-0">
                        {{ user.email.slice(0, 1).toUpperCase() }}
                      </div>
                      <div>
                        <div class="font-semibold text-surface-900 dark:text-surface-100">{{ user.name }}</div>
                        <div class="text-surface-400 text-[11px] font-mono">{{ user.email }}</div>
                      </div>
                    </div>
                  </td>

                  <td class="py-3.5 px-4">
                    <div class="flex flex-wrap gap-1.5 items-center">
                      <button
                        v-for="role in availableRoles"
                        :key="role"
                        @click="handleToggleRole(user._id, role)"
                        :disabled="updatingUserId === user._id"
                        :class="[
                          'px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50',
                          user.roles.includes(role) ? getRoleBadgeStyle(role) : 'bg-transparent border-dashed border-surface-300 dark:border-surface-700 text-surface-400 hover:border-surface-400 hover:text-surface-600 dark:hover:text-surface-200'
                        ]"
                      >
                        <Check v-if="user.roles.includes(role)" class="w-3 h-3" />
                        <span class="capitalize">{{ role }}</span>
                      </button>
                    </div>
                  </td>

                  <td class="py-3.5 px-4 text-right font-mono text-[11px] text-surface-400 shrink-0">
                    {{ user._id }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- TAB 2: Effective Permissions Matrix -->
        <div v-else-if="activeTab === 'permissions'" class="space-y-4">
          <p class="text-xs text-surface-500 dark:text-surface-400">
            View the resolved, fine-grained permission action grants for each user. Authorization rules evaluate these explicit action strings rather than role titles.
          </p>

          <div class="border border-surface-200 dark:border-surface-800 rounded-lg overflow-hidden">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-surface-100/70 dark:bg-surface-800/70 border-b border-surface-200 dark:border-surface-800 text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                  <th class="py-3 px-4">User</th>
                  <th class="py-3 px-4">Effective Permission Action Grants</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-surface-100 dark:divide-surface-800/60 text-surface-800 dark:text-surface-200">
                <tr v-for="user in usersList" :key="user._id" class="hover:bg-surface-50/60 dark:hover:bg-surface-800/40">
                  <td class="py-3.5 px-4 font-medium shrink-0">
                    <div class="font-semibold text-surface-900 dark:text-surface-100">{{ user.email }}</div>
                    <div class="text-[11px] text-surface-400 font-mono">Roles: {{ user.roles.join(', ') || 'None' }}</div>
                  </td>

                  <td class="py-3.5 px-4">
                    <div class="flex flex-wrap gap-1.5">
                      <span
                        v-for="grant in user.permissions"
                        :key="grant"
                        class="px-2 py-0.5 rounded bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 font-mono text-[11px] text-primary-600 dark:text-primary-400"
                      >
                        {{ grant }}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- TAB 3: Password Reset Form -->
        <div v-else-if="activeTab === 'password'" class="max-w-md mx-auto py-4 space-y-5">
          <div class="text-center space-y-1">
            <div class="inline-flex p-3 rounded-full bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 mb-2">
              <Lock class="w-6 h-6" />
            </div>
            <h3 class="text-base font-semibold text-surface-900 dark:text-surface-100">Reset User Account Password</h3>
            <p class="text-xs text-surface-500 dark:text-surface-400">Change a user's login password directly from the administrative UI.</p>
          </div>

          <div class="space-y-4 bg-surface-50 dark:bg-surface-800/50 p-5 rounded-xl border border-surface-200 dark:border-surface-800">
            <div>
              <label class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1.5">Select Target User Account</label>
              <select
                v-model="selectedUserEmail"
                class="w-full px-3.5 py-2 text-xs rounded-lg bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="" disabled>-- Select User --</option>
                <option v-for="user in usersList" :key="user._id" :value="user.email">
                  {{ user.email }} ({{ user.name }})
                </option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1.5">New Password</label>
              <div class="relative">
                <input
                  v-model="newPasswordInput"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Enter new strong password"
                  class="w-full px-3.5 py-2 text-xs rounded-lg bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <button
                  type="button"
                  @click="showPassword = !showPassword"
                  class="absolute right-3 top-2.5 text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-200"
                >
                  {{ showPassword ? 'Hide' : 'Show' }}
                </button>
              </div>
            </div>

            <button
              @click="handleResetPassword"
              :disabled="isResettingPassword || !selectedUserEmail || !newPasswordInput"
              class="w-full py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw v-if="isResettingPassword" class="w-4 h-4 animate-spin" />
              <Key v-else class="w-4 h-4" />
              <span>Reset Password Now</span>
            </button>
          </div>
        </div>

      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-3 border-t border-surface-200 dark:border-surface-800 flex justify-end bg-surface-50/50 dark:bg-surface-900/50">
        <button
          @click="emit('close')"
          class="px-4 py-2 text-xs font-medium rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
        >
          Close Panel
        </button>
      </div>

    </div>
  </div>
</template>
