import { toast as reactToastify, ToastOptions } from 'react-toastify';

interface ToastWithDescriptionOptions extends ToastOptions {
  description?: string;
}

// Helper to format toast content with description using custom styling
const formatToastContent = (message: string, description?: string) => {
  if (!description) {
    return (
      <div className="toast-title">{message}</div>
    );
  }
  
  return (
    <div>
      <div className="toast-title">{message}</div>
      <div className="toast-description">{description}</div>
    </div>
  );
};

// Wrapper functions to maintain Sonner-like API
export const toast = (message: string, options?: ToastWithDescriptionOptions) => {
  const { description, ...restOptions } = options || {};
  return reactToastify(formatToastContent(message, description), restOptions);
};

toast.success = (message: string, options?: ToastWithDescriptionOptions) => {
  const { description, ...restOptions } = options || {};
  return reactToastify.success(formatToastContent(message, description), restOptions);
};

toast.error = (message: string, options?: ToastWithDescriptionOptions) => {
  const { description, ...restOptions } = options || {};
  return reactToastify.error(formatToastContent(message, description), restOptions);
};

toast.info = (message: string, options?: ToastWithDescriptionOptions) => {
  const { description, ...restOptions } = options || {};
  return reactToastify.info(formatToastContent(message, description), restOptions);
};

toast.warning = (message: string, options?: ToastWithDescriptionOptions) => {
  const { description, ...restOptions } = options || {};
  return reactToastify.warning(formatToastContent(message, description), restOptions);
};

toast.loading = (message: string, options?: ToastWithDescriptionOptions) => {
  const { description, ...restOptions } = options || {};
  return reactToastify.loading(formatToastContent(message, description), restOptions);
};
