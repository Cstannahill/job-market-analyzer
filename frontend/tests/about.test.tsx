import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { test, expect } from 'vitest';
import '@testing-library/jest-dom';
import About from '../src/pages/About';

// Basic smoke test for new About page structure
test('renders core About headings', () => {
    render(
        <MemoryRouter>
            <About />
        </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /About Job Market Analyzer/i })).toBeInTheDocument();
    expect(screen.getByText(/Core Capabilities/i)).toBeInTheDocument();
    expect(screen.getByText(/Data Pipeline Overview/i)).toBeInTheDocument();
    expect(screen.getByText(/Methodology & Caveats/i)).toBeInTheDocument();
    expect(screen.getByText(/Roadmap/i)).toBeInTheDocument();
});
