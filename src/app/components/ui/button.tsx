import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";

import { cn } from "@/app/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-btb-primary/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light text-white shadow-md shadow-btb-primary/20 hover:shadow-lg hover:shadow-btb-primary/30 hover:scale-[1.02] active:scale-[0.98]",
        destructive:
          "bg-red-500 text-white hover:bg-red-500/90 dark:bg-red-900 dark:text-white dark:hover:bg-red-900/90 shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98]",
        outline:
          "border-2 border-btb-primary text-btb-primary hover:bg-btb-primary hover:text-white dark:border-btb-primary dark:text-btb-primary dark:hover:bg-btb-primary dark:hover:text-white hover:scale-[1.02] active:scale-[0.98]",
        secondary:
          "bg-white/80 backdrop-blur-sm text-btb-primary border border-btb-primary/20 hover:bg-btb-primary/10 dark:bg-gray-800/80 dark:text-btb-primary-light dark:border-btb-primary-light/20 dark:hover:bg-btb-primary-light/10 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
        ghost: "hover:bg-btb-primary/10 hover:text-btb-primary dark:hover:bg-btb-primary/10 dark:hover:text-btb-primary-light hover:scale-[1.02] active:scale-[0.98]",
        link: "text-btb-primary underline-offset-4 hover:underline dark:text-btb-primary-light hover:text-btb-primary-dark dark:hover:text-btb-primary",
        glass: "bg-white/10 backdrop-blur-md border border-white/30 text-white hover:bg-white/20 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-md px-4 py-1.5 text-xs",
        lg: "h-12 rounded-lg px-8 py-3 text-base",
        xl: "h-14 rounded-xl px-10 py-4 text-lg",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  withRipple?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    asChild = false, 
    isLoading = false,
    leftIcon,
    rightIcon,
    withRipple = true,
    children,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : "button";
    const [ripples, setRipples] = React.useState<{id: number, x: number, y: number}[]>([]);
    
    const handleRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!withRipple) return;
      
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const ripple = {
        id: Date.now(),
        x,
        y,
      };
      
      setRipples((prev) => [...prev, ripple]);
      
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
      }, 1000);
    };
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleRipple}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {/* Ripple effect */}
        {withRipple && ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="absolute rounded-full bg-white/30 animate-ripple"
            style={{
              top: ripple.y,
              left: ripple.x,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          />
        ))}
        
        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-inherit rounded-lg">
            <div className="h-5 w-5 rounded-full border-2 border-t-transparent border-white animate-spin" />
          </div>
        )}
        
        {/* Button content with conditional opacity when loading */}
        <div className={cn("flex items-center justify-center gap-2", isLoading && "opacity-0")}>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </div>
      </Comp>
    );
  }
);
Button.displayName = "Button";

// Motion Button component that adds animation capabilities
export const MotionButton = React.forwardRef<HTMLButtonElement, ButtonProps & React.ComponentProps<typeof motion.button>>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref as any}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        {...props}
      />
    );
  }
);
MotionButton.displayName = "MotionButton";

export { Button, buttonVariants };
