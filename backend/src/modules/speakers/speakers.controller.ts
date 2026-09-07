import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SpeakersService } from './speakers.service.js';
import { CreateSpeakerDto } from './dto/create-speaker.dto.js';
import { UpdateSpeakerDto } from './dto/update-speaker.dto.js';
import { toSpeakerResponse } from './speakers.mapper.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Role } from '../../common/enums/role.enum.js';

@ApiTags('Speakers')
@ApiBearerAuth()
@Controller('speakers')
export class SpeakersController {
  constructor(private readonly speakersService: SpeakersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EVENT_MANAGER)
  async create(@Body() dto: CreateSpeakerDto) {
    const speaker = await this.speakersService.create(dto);
    return toSpeakerResponse(speaker);
  }

  @Get()
  async findAll(@Query() query: PaginationQueryDto) {
    const result = await this.speakersService.findAll(query);
    return {
      items: result.items.map(toSpeakerResponse),
      meta: result.meta,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const speaker = await this.speakersService.findById(id);
    return toSpeakerResponse(speaker);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EVENT_MANAGER)
  async update(@Param('id') id: string, @Body() dto: UpdateSpeakerDto) {
    const speaker = await this.speakersService.update(id, dto);
    return toSpeakerResponse(speaker);
  }
}
