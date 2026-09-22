import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersService } from './users.service.js';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

const ADMIN_ID = new Types.ObjectId().toString();
const OTHER_USER_ID = new Types.ObjectId().toString();

function buildActor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { userId: ADMIN_ID, email: 'admin@example.com', role: Role.ADMIN, ...overrides };
}

function buildUserModel(found: unknown = { _id: OTHER_USER_ID, role: Role.VIEWER }) {
  return {
    findByIdAndUpdate: vi.fn().mockReturnValue({ exec: () => Promise.resolve(found) }),
  };
}

describe('UsersService', () => {
  describe('updateRole - self-lockout guard', () => {
    it('rejects an Admin changing their own role', async () => {
      const userModel = buildUserModel();
      const service = new UsersService(userModel as any);

      await expect(service.updateRole(ADMIN_ID, Role.VIEWER, buildActor())).rejects.toThrow(
        BadRequestException,
      );
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('allows an Admin to change another user\'s role', async () => {
      const userModel = buildUserModel();
      const service = new UsersService(userModel as any);

      await expect(
        service.updateRole(OTHER_USER_ID, Role.EVENT_MANAGER, buildActor()),
      ).resolves.toBeDefined();
    });
  });

  describe('updateStatus - self-lockout guard', () => {
    it('rejects an Admin deactivating their own account', async () => {
      const userModel = buildUserModel();
      const service = new UsersService(userModel as any);

      await expect(service.updateStatus(ADMIN_ID, false, buildActor())).rejects.toThrow(
        BadRequestException,
      );
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('allows an Admin to deactivate another user\'s account', async () => {
      const userModel = buildUserModel();
      const service = new UsersService(userModel as any);

      await expect(
        service.updateStatus(OTHER_USER_ID, false, buildActor()),
      ).resolves.toBeDefined();
    });
  });
});
