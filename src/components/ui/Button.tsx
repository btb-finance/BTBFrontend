'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { HTMLMotionProps, motion } from 'framer-motion';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'gradient-border glow bg-[var(--background-light)] hover:bg-[var(--background-dark)]',
        secondary:
          'border border-[var(--border-color)] hover:bg-[var(--background-light)]',
        ghost: 'hover:bg-[var(--background-light)] hover:text-[var(--primary)]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-12 rounded-lg px-8 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

type ButtonBaseProps = ButtonHTMLAttributes<HTMLButtonElement> & 
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
  };

export interface ButtonProps extends ButtonBaseProps {
  children: React.ReactNode;
}

const ButtonComponent = motion.button;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, icon, children, ...props }, ref) => {
    const Comp = asChild ? Slot : ButtonComponent;
    const motionProps: HTMLMotionProps<"button"> = {
      whileHover: { scale: 1.02 },
      whileTap: { scale: 0.98 },
    };

    const buttonContent = (
      <span className="inline-flex items-center gap-2">
        {loading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {icon && <span>{icon}</span>}
        {children}
      </span>
    );

    return (
      <Comp
        ref={ref}
        {...(asChild ? {} : motionProps)}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={props.disabled || loading}
        {...props}
      >
        {buttonContent}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
