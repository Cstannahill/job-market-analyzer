import React from 'react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TechSearchCombobox, type TechOption, type TechSearchValue } from '@/components/postings/TechSearchCombobox';

const cancelMock = vi.fn();

vi.mock('@/hooks/useDebouncedCallback', () => ({
  useDebouncedCallback: (fn: (value: string) => void) => [fn, cancelMock] as const,
}));

vi.mock('lucide-react', () => ({
  Check: ({ onClick, 'aria-label': ariaLabel }: { onClick?: () => void; 'aria-label'?: string }) => (
    <span role="img" aria-label={ariaLabel} onClick={onClick} />
  ),
  ChevronDown: () => <span data-testid="chevron" />,
  X: ({ onClick, 'aria-label': ariaLabel }: { onClick?: (event: React.MouseEvent) => void; 'aria-label'?: string }) => (
    <span role="img" aria-label={ariaLabel} onClick={onClick} />
  ),
}));

vi.mock('@/components/ui/command', () => {
  const Command = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const CommandList = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const CommandGroup = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const CommandEmpty = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const CommandInput = ({
    value,
    onValueChange,
    onKeyDown,
    placeholder,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    placeholder?: string;
  }) => (
    <input
      data-testid="command-input"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onValueChange?.(event.target.value)}
      onKeyDown={onKeyDown}
    />
  );
  const CommandItem = ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
  }) => (
    <div role="button" tabIndex={0} onClick={() => onSelect?.()}>
      {children}
    </div>
  );
  return { Command, CommandList, CommandGroup, CommandEmpty, CommandInput, CommandItem };
});

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const options: TechOption[] = [
  { value: 'react', label: 'React', count: 100 },
  { value: 'node', label: 'Node.js', count: 80 },
];

const renderCombobox = (
  value: TechSearchValue = { tech: null, query: '' },
  overrides: Partial<React.ComponentProps<typeof TechSearchCombobox>> = {},
) => {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  render(
    <TechSearchCombobox
      value={value}
      onChange={onChange}
      onCommit={onCommit}
      options={options}
      {...overrides}
    />,
  );
  return { onChange, onCommit };
};

describe('TechSearchCombobox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('commits a technology selection', () => {
    const { onChange, onCommit } = renderCombobox();
    fireEvent.click(screen.getByText('React'));
    expect(onChange).toHaveBeenCalledWith({ tech: 'react', query: '' });
    expect(onCommit).toHaveBeenCalledWith({ tech: 'react', query: '' });
  });

  it('clears selection via the all option', () => {
    const { onChange, onCommit } = renderCombobox({ tech: 'react', query: '' });
    fireEvent.click(screen.getByText('All Technologies'));
    expect(onChange).toHaveBeenCalledWith({ tech: null, query: '' });
    expect(onCommit).toHaveBeenCalledWith({ tech: null, query: '' });
  });

  it('updates query via typing and enter', () => {
    const { onChange, onCommit } = renderCombobox();
    const input = screen.getByTestId('command-input');
    fireEvent.change(input, { target: { value: 'aws' } });
    expect(onChange).toHaveBeenLastCalledWith({ tech: null, query: 'aws' });

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenLastCalledWith({ tech: null, query: 'aws' });
  });

  it('clears via the clear icon', () => {
    const { onChange } = renderCombobox({ tech: 'react', query: '' });
    fireEvent.click(screen.getByLabelText('Clear'));
    expect(onChange).toHaveBeenCalledWith({ tech: null, query: '' });
  });
});
