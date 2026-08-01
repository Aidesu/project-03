import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class SubmitReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsBoolean()
  didRespond!: boolean;
}
