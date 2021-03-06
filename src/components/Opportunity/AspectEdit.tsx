import React, { FC } from 'react';
import { Form, Modal } from 'react-bootstrap';
import Button from '../core/Button';
import {
  AspectInput,
  useAspectsTemplateListQuery,
  useCreateAspectMutation,
  useUpdateAspectMutation,
} from '../../generated/graphql';
import * as yup from 'yup';
import { Formik } from 'formik';
import { TextArea } from '../core/TextInput';
import { createStyles } from '../../hooks/useTheme';
import { QUERY_OPPORTUNITY_ACTOR_GROUPS } from '../../graphql/opportunity';

interface Props {
  show: boolean;
  onHide: () => void;
  data?: AspectInput;
  id?: string;
  opportunityId?: string | undefined;
  actorGroupId?: string;
  isCreate?: boolean;
  existingAspectNames?: string[];
}

const useContextEditStyles = createStyles(theme => ({
  field: {
    marginBottom: theme.shape.spacing(2),
  },
  row: {
    display: 'flex',
    gap: 20,
    alignItems: 'center',
    '& > div': {
      flexGrow: 1,
    },
  },
  body: {
    maxHeight: 600,
    overflow: 'auto',
  },
}));

const AspectEdit: FC<Props> = ({ show, onHide, data, id, opportunityId, isCreate, existingAspectNames }) => {
  const styles = useContextEditStyles();
  const { data: config } = useAspectsTemplateListQuery();
  const aspectsTypes = config?.configuration.template.opportunities[0].aspects?.map(a => a);
  const availableTypes =
    isCreate && existingAspectNames
      ? aspectsTypes?.filter(at => !existingAspectNames.includes(at.replaceAll('_', ' ')))
      : aspectsTypes;

  const initialValues: AspectInput = {
    title: isCreate ? availableTypes && availableTypes[0] : data?.title || '',
    framing: data?.framing || '',
    explanation: data?.explanation || '',
  };
  const validationSchema = yup.object().shape({
    title: yup.string().required(),
    framing: yup.string().required(),
    explanation: yup.string().required(),
  });

  const [updateAspect] = useUpdateAspectMutation({
    onCompleted: () => onHide(),
    onError: e => console.error(e),
    refetchQueries: [{ query: QUERY_OPPORTUNITY_ACTOR_GROUPS, variables: { id: Number(opportunityId) } }],
    awaitRefetchQueries: true,
  });

  const [createAspect] = useCreateAspectMutation({
    onCompleted: () => onHide(),
    onError: e => console.error(e),
    refetchQueries: [{ query: QUERY_OPPORTUNITY_ACTOR_GROUPS, variables: { id: Number(opportunityId) } }],
    awaitRefetchQueries: true,
  });

  const onSubmit = values => {
    if (isCreate) {
      createAspect({
        variables: {
          opportunityID: Number(opportunityId),
          aspectData: values,
        },
      });

      return;
    }
    updateAspect({
      variables: {
        ID: Number(id),
        aspectData: values,
      },
    });
  };

  let submitWired;

  return (
    <Modal show={show} onHide={onHide} centered size={'xl'}>
      <Modal.Header closeButton>
        <Modal.Title>Edit Aspect</Modal.Title>
      </Modal.Header>
      <Modal.Body className={styles.body}>
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          enableReinitialize
          onSubmit={values => onSubmit(values)}
        >
          {({ values, handleChange, errors, touched, handleSubmit, setFieldValue }) => {
            const getField = (name: string, label: string) => (
              <TextArea
                onChange={handleChange}
                name={name}
                value={values[name] as string}
                label={label}
                error={touched[name] && !!errors[name]}
                className={styles.field}
                rows={2}
              />
            );

            if (!submitWired) {
              submitWired = handleSubmit;
            }

            return (
              <>
                <Form.Group controlId="aspectTypeSelect">
                  <Form.Label>Aspect Type</Form.Label>
                  <Form.Control
                    as="select"
                    custom
                    onChange={e => {
                      e.preventDefault();
                      setFieldValue('title', e.target.value);
                    }}
                    size={'lg'}
                    disabled={!isCreate}
                    defaultValue={values.title?.replaceAll('_', ' ')}
                  >
                    {availableTypes?.map((at, index) => (
                      <option value={at} key={index}>
                        {at.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>
                {getField('framing', 'Framing')}
                {getField('explanation', 'Explanation')}
              </>
            );
          }}
        </Formik>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="negative" onClick={onHide} className={'mr-2'}>
          CANCEL
        </Button>
        <Button type={'submit'} variant="primary" onClick={() => submitWired()}>
          SAVE
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AspectEdit;
