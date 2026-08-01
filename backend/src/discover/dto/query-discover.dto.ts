import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export const DISCOVER_SORT_FIELDS = ['name', 'createdAt'] as const;

export class QueryDiscoverDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(DISCOVER_SORT_FIELDS)
  sortBy: (typeof DISCOVER_SORT_FIELDS)[number] = 'name';

  // Companies read best alphabetically, so default ascending (matches QueryCompaniesDto).
  override sortOrder: 'asc' | 'desc' = 'asc';
}
