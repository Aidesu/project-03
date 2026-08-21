import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class SearchRegistryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  // French department code: two digits, "2A"/"2B" (Corse), or a 3-digit
  // overseas code (971-976) — never free text.
  @IsOptional()
  @Matches(/^(\d{2}|2A|2B|97[1-6])$/)
  departmentCode?: string;

  // French region code: two digits (INSEE COG).
  @IsOptional()
  @Matches(/^\d{2}$/)
  regionCode?: string;
}
