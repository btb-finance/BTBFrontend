import * as React from "react"
import { motion, HTMLMotionProps, PanInfo } from "framer-motion"
import { cn } from "@/app/lib/utils"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "gradient" | "glass" | "outline" | "elevated"
  isHoverable?: boolean
  isInteractive?: boolean
  withAnimation?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>
(({ className, variant = "default", isHoverable = false, isInteractive = false, withAnimation = false, ...props }, ref) => {
    const baseStyles = "rounded-xl overflow-hidden";
    
    const variantStyles = {
      default: "border border-gray-200 bg-white text-gray-900 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100",
      gradient: "border-none bg-gradient-to-br from-btb-primary-dark/90 via-btb-primary/80 to-btb-primary-light/90 text-white shadow-md",
      glass: "border border-white/20 bg-white/10 backdrop-blur-md text-white shadow-lg",
      outline: "border-2 border-btb-primary/20 bg-white dark:bg-gray-900 text-gray-900 dark:text-white",
      elevated: "border-none bg-white dark:bg-gray-800 shadow-xl dark:shadow-gray-900/30 text-gray-900 dark:text-white"
    };
    
    const hoverStyles = isHoverable ? "transition-all duration-300 hover:shadow-lg dark:hover:shadow-gray-900/40 hover:translate-y-[-2px]" : "";
    const interactiveStyles = isInteractive ? "cursor-pointer active:scale-[0.98]" : "";
    
    const animationProps = withAnimation ? {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.5 },
      whileHover: isHoverable ? { y: -5, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" } : {},
      whileTap: isInteractive ? { scale: 0.98 } : {}
    } : {};

    return (
      withAnimation ? (
        <motion.div
          ref={ref}
          className={cn(
            baseStyles,
            variantStyles[variant],
            hoverStyles,
            interactiveStyles,
            className
          )}
          {...animationProps}
          // Filter out React-specific props that conflict with framer-motion
          {...(Object.keys(props).reduce((acc, key) => {
            if (!['onDrag', 'onDragStart', 'onDragEnd'].includes(key)) {
              acc[key as keyof typeof acc] = props[key as keyof typeof props];
            }
            return acc;
          }, {} as Record<string, any>))}
        />
      ) : (
        <div
          ref={ref}
          className={cn(
            baseStyles,
            variantStyles[variant],
            hoverStyles,
            interactiveStyles,
            className
          )}
          {...props}
        />
      )
    )
  }
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight font-heading",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-gray-500 dark:text-gray-400", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// Animated variants of card components
const MotionCard = motion(Card);
const MotionCardHeader = motion(CardHeader);
const MotionCardContent = motion(CardContent);
const MotionCardFooter = motion(CardFooter);

export { 
  Card, 
  CardHeader, 
  CardFooter, 
  CardTitle, 
  CardDescription, 
  CardContent,
  MotionCard,
  MotionCardHeader,
  MotionCardContent,
  MotionCardFooter
}
