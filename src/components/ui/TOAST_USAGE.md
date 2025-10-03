# Toast Notification System

This project uses `react-hot-toast` for showing toast notifications. We've created a few utility functions to make it easier to use throughout the application.

## How to Use

### Basic Usage

```tsx
import { toast } from "@/components/ui/toast";

// Show a basic toast
toast("This is a simple toast message");
```

### Utility Functions

```tsx
import { showToast, customToast } from "@/components/ui/toast";

// Show a success toast
showToast("Operation completed successfully!", "success");

// Show an error toast
showToast("An error occurred!", "error");

// Show a loading toast
showToast("Loading...", "loading");

// Show a custom toast with title and description
customToast({
  title: "Profile Updated",
  description: "Your profile information has been updated successfully."
});

// Show a custom error toast
customToast({
  variant: "destructive",
  title: "Update Failed",
  description: "There was a problem updating your profile. Please try again."
});
```

## Toast Component

The toast component is already added to the root layout, so you don't need to add it to your pages. It's available globally.

## Demo Component

For a working example of all toast types, see the `ToastDemo.tsx` component:

```tsx
import { ToastDemo } from "@/components/ui/ToastDemo";

// In your page or component
<ToastDemo />
``` 