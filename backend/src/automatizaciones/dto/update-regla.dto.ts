import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateReglaDto } from './create-regla.dto';

export class UpdateReglaDto extends PartialType(CreateReglaDto) {
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
