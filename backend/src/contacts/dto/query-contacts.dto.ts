import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export const CONTACT_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'firstName',
  'lastName',
] as const;

export class QueryContactsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsIn(CONTACT_SORT_FIELDS)
  sortBy: (typeof CONTACT_SORT_FIELDS)[number] = 'firstName';

  override sortOrder: 'asc' | 'desc' = 'asc';
}
