import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DisputeService } from './dispute.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @Post()
  async createDispute(@Request() req, @Body() dto: CreateDisputeDto) {
    return this.disputeService.createDispute(req.user.sub, dto);
  }

  @Get()
  async getDisputes(
    @Request() req,
    @Query('status') status?: string,
    @Query('contractId') contractId?: string,
  ) {
    return this.disputeService.getDisputes({
      status,
      contractId,
      userId: req.user.sub,
    });
  }

  @Get(':id')
  async getDisputeById(@Param('id') id: string) {
    return this.disputeService.getDisputeById(id);
  }
}
