<script setup lang="ts">
import { ref } from 'vue';
import { useAuth, parseConvexError } from '@writer/shared';

const { signIn, isLoading } = useAuth();

const isSignUp = ref(false);
const email = ref('');
const password = ref('');
const errorMsg = ref('');

const handleSubmit = async () => {
  errorMsg.value = '';
  if (!email.value || !password.value) {
    errorMsg.value = 'Please enter an email and password.';
    return;
  }
  
  try {
    await signIn(email.value, password.value, isSignUp.value);
  } catch (err: unknown) {
    errorMsg.value = parseConvexError(err, 'An error occurred during sign in.');
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="glass-panel w-full max-w-md p-8">
      <div class="text-center mb-8">
        <h2 class="text-3xl font-display font-bold text-gradient mb-2">Convex Writer</h2>
        <p class="text-surface-500 dark:text-surface-400">{{ isSignUp ? 'Create a new account' : 'Sign in to your account' }}</p>
      </div>

      <form @submit.prevent="handleSubmit" class="flex flex-col gap-5">
        <div>
          <label for="email" class="block text-sm font-medium mb-1">Email</label>
          <input 
            id="email"
            type="email" 
            v-model="email" 
            placeholder="you@example.com"
            required
            :disabled="isLoading"
            class="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        
        <div>
          <label for="password" class="block text-sm font-medium mb-1">Password</label>
          <input 
            id="password"
            type="password" 
            v-model="password" 
            placeholder="••••••••"
            required
            :disabled="isLoading"
            class="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div v-if="errorMsg" class="text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800/50 p-3 rounded-xl text-sm">
          {{ errorMsg }}
        </div>

        <button type="submit" class="btn-primary w-full mt-2" :disabled="isLoading">
          <span v-if="isLoading" class="flex items-center justify-center gap-2">
            <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading...
          </span>
          <span v-else>{{ isSignUp ? 'Sign Up' : 'Sign In' }}</span>
        </button>
      </form>

      <div class="mt-8 text-center text-sm text-surface-500 dark:text-surface-400">
        <p>
          {{ isSignUp ? 'Already have an account?' : "Don't have an account?" }}
          <button type="button" class="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-1" @click="isSignUp = !isSignUp" :disabled="isLoading">
            {{ isSignUp ? 'Sign In' : 'Sign Up' }}
          </button>
        </p>
      </div>
    </div>
  </div>
</template>
