import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal, ConfirmDialog } from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} title="Hidden" onClose={() => {}}>
        <p>Body</p>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders an accessible dialog labelled by its heading', () => {
    render(
      <Modal open title="Edit pizza" onClose={() => {}}>
        <p>Body</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Edit pizza' })).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Confirm" onClose={onClose}>
        <p>Body</p>
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the overlay is clicked but not the card', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Confirm" onClose={onClose}>
        <p>Body</p>
      </Modal>
    );
    const overlay = document.querySelector('.modal-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmDialog', () => {
  it('wires confirm and cancel actions', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Delete pizza"
        message="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables buttons while busy', () => {
    render(
      <ConfirmDialog
        open
        title="Delete"
        message="Sure?"
        busy
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /working/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
