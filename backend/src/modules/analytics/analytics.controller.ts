import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsQueryDto } from './dto/analytics-query.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.EVENT_MANAGER)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview(@Query() query: AnalyticsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getOverview(user, query.event);
  }

  @Get('workload')
  getWorkload(@Query() query: AnalyticsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getWorkload(user, query.event);
  }

  @Get('incidents')
  getIncidentAnalytics(@Query() query: AnalyticsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getIncidentAnalytics(user, query.event);
  }

  @Get('event-health')
  getEventHealth(@Query() query: AnalyticsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getEventHealth(user, query.event);
  }

  @Get('approval-turnaround')
  getApprovalTurnaround(@Query() query: AnalyticsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getApprovalTurnaround(user, query.event);
  }

  @Get('room-utilization')
  getRoomUtilization(@Query() query: AnalyticsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getRoomUtilization(user, query.event);
  }
}
