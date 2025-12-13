import { render } from '@testing-library/react';
import Home from '../app/page';

describe('Home', () => {
  it('renders the page', () => {
    render(<Home />);
    // Basic smoke test - page renders without crashing
    expect(document.body).toBeInTheDocument();
  });
});
