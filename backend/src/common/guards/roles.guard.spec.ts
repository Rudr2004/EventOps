import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { Role } from '../enums/role.enum.js';
import type { AuthenticatedUser } from '../types/authenticated-user.js';

function createContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows access when no roles are required', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows access when the user has one of the required roles', () => {
    const reflector = {
      getAllAndOverride: () => [Role.ADMIN, Role.EVENT_MANAGER],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const user: AuthenticatedUser = { userId: '1', email: 'a@b.com', role: Role.EVENT_MANAGER };

    expect(guard.canActivate(createContext(user))).toBe(true);
  });

  it('denies access when the user role is not permitted', () => {
    const reflector = {
      getAllAndOverride: () => [Role.ADMIN],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const user: AuthenticatedUser = { userId: '1', email: 'a@b.com', role: Role.VIEWER };

    expect(() => guard.canActivate(createContext(user))).toThrow(ForbiddenException);
  });

  it('denies access when there is no authenticated user', () => {
    const reflector = {
      getAllAndOverride: () => [Role.ADMIN],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createContext(undefined))).toThrow(ForbiddenException);
  });
});
