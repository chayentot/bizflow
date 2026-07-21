"use client";

import { useFormStatus } from "react-dom";

type FormButtonProps = {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
  confirmMessage?: string;
};

export function FormButton({
  children,
  pendingText = "Saving...",
  className = "btn",
  disabled = false,
  confirmMessage,
}: FormButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          {pendingText}
        </span>
      ) : children}
    </button>
  );
}
