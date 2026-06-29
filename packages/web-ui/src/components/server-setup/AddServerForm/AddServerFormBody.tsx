import React from 'react';
import { ServerConnectionFields } from '../ServerConnectionFields';
import { TestConnectionFeedback } from '../TestConnectionFeedback';
import type { TestConnectionFeedbackState } from '../TestConnectionFeedback/types';
import { StepIndicator } from '../StepIndicator';
import { Button, Spinner } from '@taurent/web-ui';
import type { AddServerFormBodyProps } from './types';

export const AddServerFormBody = React.memo<AddServerFormBodyProps>(({
  variant = 'desktop',
  name,
  onNameChange,
  url,
  onUrlChange,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  rememberPassword,
  onRememberPasswordChange,
  validationErrors,
  error,
  testResult,
  testingConnection,
  loading,
  onTestConnection,
  onSubmit,
  testErrorSuggestion,
}) => {
  const isFormValid = url.trim() !== '' && username.trim() !== '';

  if (variant === 'mobile') {
    return (
      <div className="flex flex-col gap-5">
        {error && (
          <div className="p-3 rounded-sm bg-error/10 border border-error/30">
            <p className="text-sm text-error font-medium">{error}</p>
          </div>
        )}

        {testResult && (
          <TestConnectionFeedback
            state={testResult.success ? 'success' : 'error'}
            errorMessage={testResult.error}
            suggestion={testErrorSuggestion}
          />
        )}

        <ServerConnectionFields
          name={name}
          onNameChange={onNameChange}
          showNameField={true}
          url={url}
          onUrlChange={onUrlChange}
          username={username}
          onUsernameChange={onUsernameChange}
          password={password}
          onPasswordChange={onPasswordChange}
          rememberPassword={rememberPassword}
          onRememberPasswordChange={onRememberPasswordChange}
          disabled={testingConnection || loading}
          className="space-y-2"
          validationErrors={validationErrors}
        />

        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onSubmit}
          disabled={!isFormValid || testingConnection || loading}
          title="Server URL and Username are required."
          className="w-full"
        >
          {testingConnection || loading ? (
            <>
              <Spinner variant="ring" size="md" />
              {(testingConnection ? 'Testing connection...' : 'Connecting...')}
            </>
          ) : (
            'Add & Connect'
          )}
        </Button>
      </div>
    );
  }

  // Desktop variant
  const feedbackState: TestConnectionFeedbackState = testingConnection
    ? 'testing'
    : testResult?.success
      ? 'success'
      : testResult && !testResult.success
        ? 'error'
        : 'idle';

  const steps = [
    { label: 'Enter Details', active: !testResult, completed: testResult?.success === true },
    { label: 'Test Connection', active: !!testResult, completed: testResult?.success === true },
  ];

  return (
    <div className="space-y-4">
      {error && (
        <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-sm text-error text-sm">
          {error}
        </div>
      )}

      <TestConnectionFeedback
        state={feedbackState}
        errorMessage={testResult?.error}
        suggestion={testErrorSuggestion}
      />

      <StepIndicator steps={steps} />

      <ServerConnectionFields
        name={name}
        onNameChange={onNameChange}
        showNameField={true}
        url={url}
        onUrlChange={onUrlChange}
        username={username}
        onUsernameChange={onUsernameChange}
        password={password}
        onPasswordChange={onPasswordChange}
        rememberPassword={rememberPassword}
        onRememberPasswordChange={onRememberPasswordChange}
        disabled={testingConnection || loading}
        validationErrors={validationErrors}
      />

      <div className="flex flex-col gap-3 pt-4">
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onTestConnection}
            disabled={!isFormValid || testingConnection || loading}
            className="flex-1"
          >
            {testingConnection ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button
            type="button"
            disabled={!isFormValid || !testResult?.success || loading}
            className="flex-1"
            onClick={onSubmit}
          >
            {loading ? 'Adding...' : 'Add Server'}
          </Button>
        </div>
        {!isFormValid && (
          <p className="text-xs text-text-muted text-center">
            Server URL and Username are required.
          </p>
        )}
      </div>
    </div>
  );
});

AddServerFormBody.displayName = 'AddServerFormBody';
