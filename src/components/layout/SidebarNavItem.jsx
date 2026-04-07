import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'

export function SidebarNavItem({ to, icon: Icon, label, variant = 'rail', onNavigate, end = false }) {
  const baseClass =
    variant === 'drawer'
      ? 'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150'
      : 'w-8 h-8 rounded-md flex items-center justify-center transition-all duration-150 flex-shrink-0'

  const activeClass =
    variant === 'drawer'
      ? 'bg-rust/12 border border-rust/20 text-rust shadow-[0_0_0_1px_rgba(224,95,64,0.06)]'
      : 'bg-rust/15 border border-rust/25 text-rust'

  const idleClass =
    variant === 'drawer'
      ? 'text-t2 hover:text-t1 hover:bg-surface2 border border-transparent'
      : 'text-t3 hover:text-t2 hover:bg-surface2'

  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      aria-label={label}
      onClick={onNavigate}
      className={({ isActive }) => clsx(baseClass, isActive ? activeClass : idleClass)}
    >
      <Icon size={variant === 'drawer' ? 16 : 15} />
      {variant === 'drawer' && <span className="text-sm font-medium">{label}</span>}
    </NavLink>
  )
}
