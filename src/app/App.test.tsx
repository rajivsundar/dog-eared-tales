import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('shows the name and tagline', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'Twice Told' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Great free stories, picked for you. Start short. Fall for the classics.',
      ),
    ).toBeInTheDocument()
  })
})
