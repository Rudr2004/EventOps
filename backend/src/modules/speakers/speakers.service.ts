import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Speaker, SpeakerDocument } from './schemas/speaker.schema.js';
import { CreateSpeakerDto } from './dto/create-speaker.dto.js';
import { UpdateSpeakerDto } from './dto/update-speaker.dto.js';
import type { PaginatedResult, PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

@Injectable()
export class SpeakersService {
  constructor(@InjectModel(Speaker.name) private readonly speakerModel: Model<SpeakerDocument>) {}

  async create(dto: CreateSpeakerDto): Promise<SpeakerDocument> {
    return this.speakerModel.create({
      name: dto.name,
      title: dto.title ?? '',
      bio: dto.bio ?? '',
      email: dto.email ?? '',
    });
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedResult<SpeakerDocument>> {
    const [items, total] = await Promise.all([
      this.speakerModel.find().skip(query.skip).limit(query.limit).sort({ name: 1 }).exec(),
      this.speakerModel.countDocuments().exec(),
    ]);

    return {
      items,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findById(id: string): Promise<SpeakerDocument> {
    const speaker = await this.speakerModel.findById(id).exec();
    if (!speaker) {
      throw new NotFoundException('Speaker not found');
    }
    return speaker;
  }

  async update(id: string, dto: UpdateSpeakerDto): Promise<SpeakerDocument> {
    const speaker = await this.findById(id);
    if (dto.name !== undefined) speaker.name = dto.name;
    if (dto.title !== undefined) speaker.title = dto.title;
    if (dto.bio !== undefined) speaker.bio = dto.bio;
    if (dto.email !== undefined) speaker.email = dto.email;
    await speaker.save();
    return speaker;
  }
}
