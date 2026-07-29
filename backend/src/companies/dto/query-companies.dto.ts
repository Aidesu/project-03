import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export const COMPANY_SORT_FIELDS = ['createdAt', 'updatedAt', 'name'] as const;

export class QueryCompaniesDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(COMPANY_SORT_FIELDS)
  sortBy: (typeof COMPANY_SORT_FIELDS)[number] = 'name';

  // Companies read best alphabetically, so default ascending.
  override sortOrder: 'asc' | 'desc' = 'asc';
}
