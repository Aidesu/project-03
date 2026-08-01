import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const IANA_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));

@ValidatorConstraint({ name: 'isIanaTimezone', async: false })
export class IsIanaTimezoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && IANA_TIMEZONES.has(value);
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
