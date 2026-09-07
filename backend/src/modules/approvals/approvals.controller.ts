import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service.js';
import { ApproveEventDto } from './dto/approve-event.dto.js';
import { RejectEventDto } from './dto/reject-event.dto.js';
import { toApprovalHistoryResponse } from './approvals.mapper.js';
import { toEventResponse } from '../events/events.mapper.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

@ApiTags('Approvals')
@ApiBearerAuth()
@Controller('events/:eventId')
@UseGuards(RolesGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Post('submit')
  @Roles(Role.EVENT_MANAGER)
  async submit(@Param('eventId') eventId: string, @CurrentUser() user: AuthenticatedUser) {
    const event = await this.approvalsService.submit(eventId, user);
    return toEventResponse(event);
  }

  @Post('approve')
  @Roles(Role.ADMIN)
  async approve(
    @Param('eventId') eventId: string,
    @Body() dto: ApproveEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const event = await this.approvalsService.approve(eventId, dto.comment, user);
    return toEventResponse(event);
  }

  @Post('reject')
  @Roles(Role.ADMIN)
  async reject(
    @Param('eventId') eventId: string,
    @Body() dto: RejectEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const event = await this.approvalsService.reject(eventId, dto.reason, user);
    return toEventResponse(event);
  }

  @Get('approval-history')
  @Roles(Role.ADMIN, Role.EVENT_MANAGER, Role.OPERATIONS_MEMBER, Role.VIEWER)
  async getHistory(@Param('eventId') eventId: string) {
    const history = await this.approvalsService.getHistory(eventId);
    return history.map(toApprovalHistoryResponse);
  }
}
