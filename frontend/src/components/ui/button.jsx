export function Button({ children, className = '', variant = 'default', size = 'md', ...props }) {
  const baseClasses = 'inline-flex items-center justify-center rounded-xl border font-medium transition focus:outline-none focus:ring-2 focus:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-60'

  const variantClasses = {
    default: 'border-transparent bg-accent text-white hover:bg-accent-strong',
    secondary: 'border-border bg-panel text-ink hover:bg-accent-soft',
    danger: 'border-transparent bg-red-600 text-white hover:bg-red-500',
    ghost: 'border-transparent bg-transparent text-body hover:bg-accent-soft',
  }[variant] || variant

  const sizeClasses = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-5 text-base',
  }[size] || size

  return (
    <button className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}
