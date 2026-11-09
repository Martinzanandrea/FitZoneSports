import { PartialType } from '@nestjs/swagger';
import { CreateSedeDto } from './create-sede.dto';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
export class UpdateSedeDto extends PartialType(CreateSedeDto) {}
