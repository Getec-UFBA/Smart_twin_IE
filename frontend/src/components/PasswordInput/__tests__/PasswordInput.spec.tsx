import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PasswordInput from '../index';

describe('PasswordInput Component', () => {
  it('deve renderizar o label e o input inicialmente com type password', () => {
    render(<PasswordInput id="pwd" label="Sua Senha" />);

    expect(screen.getByLabelText('Sua Senha')).toBeInTheDocument();
    const input = screen.getByLabelText('Sua Senha') as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('deve alternar a visibilidade da senha ao clicar no ícone de toggle', () => {
    render(<PasswordInput id="pwd" label="Sua Senha" />);

    const input = screen.getByLabelText('Sua Senha') as HTMLInputElement;
    const toggleButton = input.parentElement?.querySelector('.password-toggle');
    expect(toggleButton).toBeTruthy();

    // Clica para exibir a senha
    if (toggleButton) {
      fireEvent.click(toggleButton);
      expect(input.type).toBe('text');

      // Clica novamente para esconder
      fireEvent.click(toggleButton);
      expect(input.type).toBe('password');
    }
  });
});
