import { createMiddleware } from '@tanstack/react-start'

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    return next({
      context: {
        userId: null,
        claims: {},
      },
    })
  },
)
