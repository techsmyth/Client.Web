import React, { FC } from 'react';
import { useAuthenticate } from '../../hooks/useAuthenticate';
import { createStyles } from '../../hooks/useTheme';
import { useUserContext } from '../../hooks/useUserContext';
import Backdrop from '../core/Backdrop';
import Button from '../core/Button';
import Typography from '../core/Typography';

const useBackdropStyles = createStyles(theme => ({
  backdropContainer: {
    position: 'absolute',
    display: 'flex',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
    placeContent: 'center',
    alignItems: 'center',
    padding: theme.shape.spacing(4),
  },
  message: {
    textAlign: 'center',
  },
}));

interface Props {
  open?: boolean;
  blockName: string;
}

const AuthenticationBackdrop: FC<Props> = ({ children, blockName, open = false }) => {
  const { safeAuthenticate } = useAuthenticate();
  const { user } = useUserContext();
  const styles = useBackdropStyles();

  if (user && !open) return <>{children}</>;

  return (
    <div style={{ position: 'relative' }}>
      <Backdrop>{children}</Backdrop>
      <div className={styles.backdropContainer}>
        <Typography variant="h3" className={styles.message}>
          Please sign in to check out the {blockName}.
        </Typography>
        <div>
          <Button onClick={() => safeAuthenticate()} text={'Sign in'} />
        </div>
      </div>
    </div>
  );
};

export default AuthenticationBackdrop;
