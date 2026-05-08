import toast, { ToastOptions } from 'react-hot-toast';

// Re-export the toast function from react-hot-toast for direct use
export { toast };

// Create a utility function for displaying toast notifications with consistent styling
export const showToast = (message: string, type: 'success' | 'error' | 'loading' = 'success', options?: ToastOptions) => {
  const baseOptions: ToastOptions = {
    duration: 4000,
    position: 'top-right',
    ...options,
  };

  switch (type) {
    case 'success':
      return toast.success(message, baseOptions);
    case 'error':
      return toast.error(message, baseOptions);
    case 'loading':
      return toast.loading(message, baseOptions);
    default:
      return toast(message, baseOptions);
  }
};

// Custom toast component with title and description
interface CustomToastProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

// Function to create a custom toast with title and description
export const customToast = ({
  title,
  description,
  variant = 'default',
}: CustomToastProps) => {
  const toastType = variant === 'destructive' ? 'error' : 'success';
  const message = title && description 
    ? <div><strong>{title}</strong><br />{description}</div>
    : title || description || '';
  
  return showToast(message as string, toastType);
}; 