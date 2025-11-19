import React from 'react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobPostingsControls, type JobPostingsFilters } from '@/components/postings/JobPostingsControls';
import type { TechnologyStatItem } from '@/shared-types';

vi.mock('@/components/postings/TechSearchCombobox', () => ({
  TechSearchCombobox: ({ onCommit }: { onCommit: (value: { tech: string | null }) => void }) => (
    <button type="button" onClick={() => onCommit({ tech: 'react' })}>
      pick react
    </button>
  ),
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id: string;
    checked: boolean;
    onCheckedChange: (next: boolean) => void;
  }) => (
    <input
      type="checkbox"
      id={id}
      aria-checked={checked}
      defaultChecked={checked}
      onChange={(event) => onCheckedChange(event.target.checked)}
    />
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <button type="button" data-value={value}>
      {children}
    </button>
  ),
  SelectValue: () => null,
}));

const baseFilters: JobPostingsFilters = {
  tech: null,
  query: '',
  workModes: [],
  seniorityLevels: [],
};

const baseProps = {
  searchTerm: '',
  onSearchChange: vi.fn(),
  selectedTech: '',
  onTechChange: vi.fn(),
  techCounts: [{ id: 'react', name: 'React', count: 100 }] as TechnologyStatItem[],
  pageIndex: 1,
  totalPages: 5,
  pageSize: 20,
  onPageSizeChange: vi.fn(),
  onPreviousPage: vi.fn(),
  onNextPage: vi.fn(),
  isPreviousDisabled: false,
  isNextDisabled: false,
  onClearFilters: vi.fn(),
  showClearFilters: false,
  onFiltersCommit: vi.fn(),
};

const renderControls = (overrideFilters: Partial<JobPostingsFilters> = {}) =>
  render(
    <JobPostingsControls
      {...baseProps}
      filters={{ ...baseFilters, ...overrideFilters }}
      techCounts={baseProps.techCounts}
    />,
  );

describe('JobPostingsControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes onFiltersCommit when a work mode checkbox is toggled', () => {
    renderControls();
    const remoteCheckbox = screen.getByLabelText('Remote');
    fireEvent.click(remoteCheckbox);
    expect(baseProps.onFiltersCommit).toHaveBeenCalledWith(
      expect.objectContaining({ workModes: ['remote'] }),
    );
  });

  it('invokes onFiltersCommit when seniority is toggled', () => {
    renderControls();
    const seniorCheckbox = screen.getByLabelText('Senior');
    fireEvent.click(seniorCheckbox);
    expect(baseProps.onFiltersCommit).toHaveBeenCalledWith(
      expect.objectContaining({ seniorityLevels: ['senior'] }),
    );
  });

  it('commits technology selections via combobox', () => {
    renderControls();
    fireEvent.click(screen.getByText('pick react'));
    expect(baseProps.onFiltersCommit).toHaveBeenCalledWith(
      expect.objectContaining({ tech: 'react' }),
    );
  });

  it('respects pagination controls', () => {
    renderControls();
    fireEvent.click(screen.getByLabelText('Previous page'));
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(baseProps.onPreviousPage).toHaveBeenCalledTimes(1);
    expect(baseProps.onNextPage).toHaveBeenCalledTimes(1);
  });
});
