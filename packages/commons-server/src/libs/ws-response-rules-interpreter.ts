import {
  Environment,
  ProcessedDatabucket,
  ResponseMode,
  ResponseRule,
  ResponseRuleTargets,
  Route,
  RouteResponse
} from '@mockoon/commons';
import { IncomingMessage } from 'http';
import { JSONPath } from 'jsonpath-plus';
import { get as objectPathGet } from 'object-path';
import { parse as parseUrl } from 'url';
import { RawData } from 'ws';
import { TemplateParser } from './template-parser';
import {
  getRawWebSocketBodyAsString,
  parseWebSocketMessage
} from './templating-helpers/web-socket-helpers';
import { convertPathToArray } from './utils';

/**
 * Interpretor for the route response rules.
 * Extract the rules targets from the request (body, headers, etc).
 * Get the first route response for which at least one rule is fulfilled.
 *
 * For CRUD routes:
 * - default response is the one linked to CRUD operations
 * - SEQUENTIAL, RANDOM and DISABLE_RULES modes are still working
 * - default response shouldn't have rules
 */
export class WebSocketResponseRulesInterpreter {
  private targets: {
    [key in Exclude<
      ResponseRuleTargets,
      'header' | 'request_number' | 'cookie' | 'body'
    >]: any;
  };

  constructor(
    private routeResponses: RouteResponse[],
    private request: IncomingMessage,
    private responseMode: Route['responseMode'],
    private environment: Environment,
    private processedDatabuckets: ProcessedDatabucket[]
  ) {
    this.extractTargets();
  }

  /**
   * Choose the route response depending on the first fulfilled rule.
   * If no rule has been fulfilled get the first route response.
   */
  public chooseResponse(
    requestNumber: number,
    message?: RawData
  ): RouteResponse | null {
    // if no rules were fulfilled find the default one, or first one if no default
    const defaultResponse =
      this.routeResponses.find((routeResponse) => routeResponse.default) ||
      this.routeResponses[0];

    if (this.responseMode === ResponseMode.RANDOM) {
      const randomStatus = Math.floor(
        Math.random() * this.routeResponses.length
      );

      return this.routeResponses[randomStatus];
    } else if (this.responseMode === ResponseMode.SEQUENTIAL) {
      return this.routeResponses[
        (requestNumber - 1) % this.routeResponses.length
      ];
    } else if (this.responseMode === ResponseMode.DISABLE_RULES) {
      return defaultResponse;
    } else {
      let response = this.routeResponses.find((routeResponse) => {
        if (routeResponse.rules.length === 0) {
          return false;
        }

        return routeResponse.rulesOperator === 'AND'
          ? routeResponse.rules.every((rule) =>
              this.isValid(rule, requestNumber, message)
            )
          : routeResponse.rules.some((rule) =>
              this.isValid(rule, requestNumber, message)
            );
      });

      if (
        response === undefined &&
        this.responseMode === ResponseMode.FALLBACK
      ) {
        return null;
      }

      if (response === undefined) {
        response = defaultResponse;
      }

      return response;
    }
  }

  /**
   * Check a rule validity and invert it if invert is at true
   *
   * @param rule
   * @param requestNumber
   * @returns
   */
  private isValid(
    rule: ResponseRule,
    requestNumber: number,
    message?: RawData
  ) {
    let isValid = this.isValidRule(rule, requestNumber, message);

    if (rule.invert) {
      isValid = !isValid;
    }

    return isValid;
  }

  /**
   * Check if a rule is valid by comparing the value extracted from the target to the rule value
   */
  private isValidRule = (
    rule: ResponseRule,
    requestNumber: number,
    message?: RawData
  ): boolean => {
    if (!rule.target) {
      return false;
    }

    let value: any;

    if (rule.target === 'request_number') {
      value = requestNumber;
    }

    if (rule.target === 'header') {
      value = this.request.headers[rule.modifier];
    } else {
      const rawMessageBody = getRawWebSocketBodyAsString(message);
      const body = parseWebSocketMessage(this.request, rawMessageBody);

      if (rule.modifier) {
        let path: string | string[] = rule.modifier;

        const target =
          rule.target === 'body' ? body : this.targets[rule.target];

        if (typeof path === 'string') {
          if (path.startsWith('$')) {
            value = JSONPath({
              json: target,
              path: path
            });
          } else {
            path = convertPathToArray(path);
            value = objectPathGet(target, path);
          }
        }
      } else if (!rule.modifier && rule.target === 'body') {
        value = rawMessageBody;
      }
    }

    if (rule.operator === 'null' && rule.modifier) {
      return value === null || value === undefined;
    }

    if (rule.operator === 'empty_array' && rule.modifier) {
      return Array.isArray(value) && value.length < 1;
    }

    if (value === undefined) {
      return false;
    }

    // value may be explicitely null (JSON), this is considered as an empty string
    if (value === null) {
      value = '';
    }

    // rule value may be explicitely null (is shouldn't anymore), this is considered as an empty string too
    if (rule.value === null) {
      rule.value = '';
    }

    const parsedRuleValue = this.parseValue(rule.value, message);

    let regex: RegExp;

    if (rule.operator.includes('regex')) {
      regex = new RegExp(
        parsedRuleValue,
        rule.operator === 'regex_i' ? 'i' : undefined
      );

      return Array.isArray(value)
        ? value.some((arrayValue) => regex.test(arrayValue))
        : regex.test(value);
    }

    if (Array.isArray(value)) {
      return value.includes(parsedRuleValue);
    }

    return String(value) === String(parsedRuleValue);
  };

  /**
   * Extract rules targets from the request (body, headers, etc)
   */
  private extractTargets() {
    const parsedUrl = parseUrl(this.request.url || '', true);

    this.targets = {
      query: parsedUrl.query,
      params: {} // web sockets cannot still support this
    };
  }

  /**
   * Parse the value using the template parser allowing data helpers.
   *
   * @param value the value to parse
   * @returns the parsed value or the unparsed input value if parsing fails
   */
  private parseValue(value: string, message?: RawData): string {
    let parsedValue: string;
    try {
      parsedValue = TemplateParser(
        false,
        value,
        this.environment,
        this.processedDatabuckets,
        undefined,
        undefined,
        {
          message,
          request: this.request
        }
      );
    } catch (error) {
      return value;
    }

    return parsedValue;
  }
}
