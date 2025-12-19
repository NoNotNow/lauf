export class PhysicsConfiguration {
    public mass?: number;
    public damping?: number;
    public restitution?: number;
    public hasCollision: boolean = true;
    public canMove: boolean = true;
    public hasGravity: boolean = true;
    public canRotate: boolean = true;

    public FromJson(data: any): this {
        if (!data) return this;
        const g = (k: string, alt?: string) => data[k] ?? (alt ? data[alt] : undefined);

        if (g('mass', 'Mass') !== undefined) this.mass = Number(g('mass', 'Mass'));
        if (g('damping', 'Damping') !== undefined) this.damping = Number(g('damping', 'Damping'));
        if (g('restitution', 'Restitution') !== undefined) this.restitution = Number(g('restitution', 'Restitution'));
        if (g('hasCollision', 'HasCollision') !== undefined) this.hasCollision = !!g('hasCollision', 'HasCollision');
        if (g('canMove', 'CanMove') !== undefined) this.canMove = !!g('canMove', 'CanMove');
        if (g('hasGravity', 'HasGravity') !== undefined) this.hasGravity = !!g('hasGravity', 'HasGravity');
        if (g('canRotate', 'CanRotate') !== undefined) this.canRotate = !!g('canRotate', 'CanRotate');

        return this;
    }

    public ToJson(): any {
        return {
            mass: this.mass,
            damping: this.damping,
            restitution: this.restitution,
            hasCollision: this.hasCollision,
            canMove: this.canMove,
            hasGravity: this.hasGravity,
            canRotate: this.canRotate
        };
    }
}
