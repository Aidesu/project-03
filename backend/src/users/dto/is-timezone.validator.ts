import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isSupportedTimeZone } from '../../common/timezone';

@ValidatorConstraint({ name: 'isIanaTimezone', async: false })
export class IsIanaTimezoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isSupportedTimeZone(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid IANA time zone identifier.`;
  }
}

export function IsIanaTimezone(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsIanaTimezoneConstraint,
    });
  };
}
