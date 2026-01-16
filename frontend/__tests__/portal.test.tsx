import { render, screen } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    pathname: '/',
    query: {},
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  useParams: () => ({}),
}));

jest.mock('../lib/api', () => ({
  apiFetch: jest.fn(),
  getApiBase: jest.fn(() => 'http://localhost'),
}));

import Portal from '../app/portal/page';

describe('Portal page', () => {
  it('renders portal actions', () => {
    render(<Portal />);
    expect(screen.getByText(/Bienvenido a 33 F\/T Studio/i)).toBeInTheDocument();
    expect(screen.getByText(/Ingresar/i)).toBeInTheDocument();
    expect(screen.getByText(/Crear cuenta/i)).toBeInTheDocument();
  });
});
