import { applyDecorators, Type } from '@nestjs/common';
import { ApiOkResponse, ApiExtraModels, getSchemaPath, ApiCreatedResponse } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../dto/api-response.dto';

export const ApiSuccessResponse = <TModel extends Type<any>>(
  model: TModel,
  options: { isArray?: boolean; status?: number } = {},
) => {
  const status = options.status || 200;
  const isArray = options.isArray || false;
  const ResponseDecorator = status === 201 ? ApiCreatedResponse : ApiOkResponse;

  return applyDecorators(
    ApiExtraModels(ApiSuccessResponseDto, model),
    ResponseDecorator({
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiSuccessResponseDto) },
          {
            properties: {
              statusCode: {
                type: 'number',
                example: status,
              },
              data: isArray
                ? {
                    type: 'array',
                    items: { $ref: getSchemaPath(model) },
                  }
                : { $ref: getSchemaPath(model) },
            },
          },
        ],
      },
    }),
  );
};
