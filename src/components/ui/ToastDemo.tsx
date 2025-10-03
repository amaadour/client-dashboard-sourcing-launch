'use client';

import { toast, showToast, customToast } from "@/components/ui/toast";

export function ToastDemo() {
  return (
    <div className="flex flex-col gap-4 p-6 border rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Toast Notifications Demo</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Basic toast */}
        <button
          className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          onClick={() => toast('This is a basic toast message')}
        >
          Basic Toast
        </button>

        {/* Success toast */}
        <button
          className="px-4 py-2 bg-green-100 dark:bg-green-800/30 text-green-800 dark:text-green-200 rounded-md hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors"
          onClick={() => showToast('Operation completed successfully!', 'success')}
        >
          Success Toast
        </button>

        {/* Error toast */}
        <button
          className="px-4 py-2 bg-red-100 dark:bg-red-800/30 text-red-800 dark:text-red-200 rounded-md hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
          onClick={() => showToast('An error occurred!', 'error')}
        >
          Error Toast
        </button>

        {/* Loading toast */}
        <button
          className="px-4 py-2 bg-blue-100 dark:bg-blue-800/30 text-blue-800 dark:text-blue-200 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
          onClick={() => showToast('Loading...', 'loading')}
        >
          Loading Toast
        </button>

        {/* Custom toast with title and description */}
        <button
          className="px-4 py-2 bg-purple-100 dark:bg-purple-800/30 text-purple-800 dark:text-purple-200 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors"
          onClick={() => 
            customToast({
              title: 'Profile Updated',
              description: 'Your profile information has been updated successfully.',
            })
          }
        >
          Custom Toast (Success)
        </button>

        {/* Custom toast with destructive variant */}
        <button
          className="px-4 py-2 bg-orange-100 dark:bg-orange-800/30 text-orange-800 dark:text-orange-200 rounded-md hover:bg-orange-200 dark:hover:bg-orange-800/50 transition-colors"
          onClick={() => 
            customToast({
              variant: 'destructive',
              title: 'Update Failed',
              description: 'There was a problem updating your profile. Please try again.',
            })
          }
        >
          Custom Toast (Error)
        </button>
      </div>
    </div>
  );
} 