import { useDarkMode } from '../contexts/DarkModeContext';
import logoLight from '../../imports/1.png';
import logoDark from '../../imports/2.png';

interface LogoProps {
  className?: string;
  /** Force a specific variant regardless of the active theme. */
  variant?: 'light' | 'dark';
}

/**
 * Arkivo brand mark. Shows the black "a." on light surfaces and the off-white
 * "a." on dark surfaces. Pass `variant` to force one (e.g. on a dark hero that
 * exists in both themes).
 */
export function Logo({ className = 'h-8 w-8', variant }: LogoProps) {
  const { isDarkMode } = useDarkMode();
  const useDark = variant ? variant === 'dark' : isDarkMode;
  return (
    <img
      src={useDark ? logoDark : logoLight}
      alt="Arkivo"
      className={`object-contain ${className}`}
    />
  );
}
