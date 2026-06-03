import React from 'react'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost' | 'secondary'
}

export default function Button({ variant = 'default', className = '', children, ...rest }: ButtonProps) {
  const classes = ['btn']
  if (variant === 'primary') classes.push('primary')
  if (variant === 'ghost') classes.push('ghost')
  if (variant === 'secondary') classes.push('secondary')
  const all = classes.join(' ') + (className ? ` ${className}` : '')
  return (
    <button className={all} {...rest}>
      {children}
    </button>
  )
}
