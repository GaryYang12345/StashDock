import { Button, type ButtonProps } from './arc/button/button';
import styles from './DestructiveButton.module.css';

// One Arc danger treatment for reference and tag confirmations in both hosts.
export function DestructiveButton({ className = '', ...props }: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="danger" className={`${styles.button} ${className}`} />;
}
